#!/usr/bin/env bash
# بررسی دسترسی شبکه‌ی سرور به سرویس‌های لازم (مخصوص سرورهای داخل ایران).
# استفاده:  bash deploy/preflight.sh  [مسیر فایل نتیجه]
# فقط می‌خواند و چیزی را تغییر نمی‌دهد. install.sh از نتیجه‌ی آن برای انتخاب میرور استفاده می‌کند.
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

RESULT_FILE="${1:-}"

# میرورهای داکر هاب (قابل تغییر با متغیر DOCKER_MIRRORS، با فاصله جدا شوند)
DOCKER_MIRROR_CANDIDATES="${DOCKER_MIRRORS:-https://docker.arvancloud.ir https://docker.iranserver.com https://hub.hamdocker.ir https://mirror.gcr.io}"
NPM_MIRROR_CANDIDATES="${NPM_MIRRORS:-https://registry.npmmirror.com https://mirror-npm.runflare.com}"
DEBIAN_MIRROR_CANDIDATE="${DEBIAN_MIRROR_CANDIDATE:-http://mirror.arvancloud.ir/debian}"
PRISMA_MIRROR_CANDIDATE="https://registry.npmmirror.com/-/binary/prisma"

# کد HTTP یک آدرس (000 یعنی وصل نشد / زمان تمام شد)
http_code() {
  local url=$1 max=${2:-20}
  curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 8 --max-time "$max" -L "$url" 2>/dev/null || true
}

# آیا پاسخ معمولی است؟ (403 و 451 معمولاً یعنی تحریم/مسدود)
code_ok() {
  local c=${1:-000}
  [[ $c =~ ^[0-9]{3}$ ]] || return 1
  [[ $c != 000 && $c != 403 && $c != 451 && ${c:0:1} != 5 ]]
}

# تست واقعی داکر هاب: گرفتن توکن و مانیفست hello-world
docker_hub_ok() {
  local token code
  token="$(curl -sS --connect-timeout 8 --max-time 20 \
    'https://auth.docker.io/token?service=registry.docker.io&scope=repository:library/hello-world:pull' 2>/dev/null \
    | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')" || true
  [[ -n $token ]] || return 1
  code="$(curl -sS -o /dev/null -I -w '%{http_code}' --connect-timeout 8 --max-time 20 \
    -H "Authorization: Bearer $token" \
    -H 'Accept: application/vnd.oci.image.index.v1+json' \
    -H 'Accept: application/vnd.docker.distribution.manifest.list.v2+json' \
    -H 'Accept: application/vnd.docker.distribution.manifest.v2+json' \
    https://registry-1.docker.io/v2/library/hello-world/manifests/latest 2>/dev/null)" || true
  [[ $code == 200 ]]
}

# یک رجیستری داکر زنده است؟ (/v2/ باید 200 یا 401 بدهد)
registry_alive() {
  local c
  c="$(http_code "${1%/}/v2/" 15)"
  [[ $c == 200 || $c == 401 ]]
}

apt_mirror_url() {
  local u
  u="$( { grep -rhE '^[[:space:]]*(deb|URIs:)[[:space:]]' /etc/apt/sources.list /etc/apt/sources.list.d/ 2>/dev/null || true; } \
        | grep -oE 'https?://[^[:space:]]+' | grep -v -e security -e docker || true)"
  printf '%s' "${u%%$'\n'*}"
}

line() { printf '  %-10s %s\n' "$1" "$2"; }
st() { if (( $1 == 1 )); then printf 'موفق'; else printf 'ناموفق'; fi; }

main() {
  command -v curl >/dev/null 2>&1 || die "برنامه‌ی curl نصب نیست:  apt-get install -y curl"

  local codename="" apt_url apt_code
  if [[ -r /etc/os-release ]]; then
    # shellcheck disable=SC1091
    codename="$(. /etc/os-release && printf '%s' "${VERSION_CODENAME:-}")"
  fi

  info "در حال بررسی دسترسی شبکه (ممکن است تا ۲ دقیقه طول بکشد)..."

  # Docker Hub
  local hub_ok=0
  if docker_hub_ok; then hub_ok=1; fi

  # میرورهای داکر
  local alive_mirrors="" m
  for m in $DOCKER_MIRROR_CANDIDATES; do
    if registry_alive "$m"; then
      alive_mirrors="${alive_mirrors:+$alive_mirrors }$m"
    fi
  done

  # npm
  local npm_ok=0 npm_choice="" npm_alt_ok=""
  if code_ok "$(http_code https://registry.npmjs.org/is-number 25)"; then npm_ok=1; fi
  for m in $NPM_MIRROR_CANDIDATES; do
    if code_ok "$(http_code "$m/is-number" 25)"; then
      npm_alt_ok="${npm_alt_ok:+$npm_alt_ok }$m"
    fi
  done
  if (( npm_ok == 0 )) && [[ -n $npm_alt_ok ]]; then
    npm_choice="${npm_alt_ok%% *}"
  fi

  # موتورهای Prisma (هنگام build دانلود می‌شوند)
  local prisma_ok=0 prisma_choice="" pc
  pc="$(http_code https://binaries.prisma.sh/ 20)"
  if [[ $pc != 000 && $pc != 451 ]]; then prisma_ok=1; fi
  if (( prisma_ok == 0 )) && [[ " $npm_alt_ok " == *" https://registry.npmmirror.com "* ]]; then
    prisma_choice="$PRISMA_MIRROR_CANDIDATE"
  fi

  # مخزن Debian (برای نصب Chromium داخل ایمیج)
  local debian_ok=0 debian_choice=""
  if code_ok "$(http_code http://deb.debian.org/debian/dists/stable/Release 25)"; then debian_ok=1; fi
  if (( debian_ok == 0 )) && code_ok "$(http_code "$DEBIAN_MIRROR_CANDIDATE/dists/stable/Release" 25)"; then
    debian_choice="$DEBIAN_MIRROR_CANDIDATE"
  fi

  # GitHub / Let's Encrypt / apt
  local gh_ok=0 le_ok=0 apt_ok=0
  if code_ok "$(http_code https://github.com 20)"; then gh_ok=1; fi
  if code_ok "$(http_code https://acme-v02.api.letsencrypt.org/directory 20)"; then le_ok=1; fi
  apt_url="$(apt_mirror_url)"
  if [[ -n $apt_url && -n $codename ]]; then
    apt_code="$(http_code "${apt_url%/}/dists/$codename/Release" 25)"
    if code_ok "$apt_code"; then apt_ok=1; fi
  fi

  printf '\n================ نتیجه‌ی بررسی شبکه ================\n'
  line "$(st $hub_ok)"    "Docker Hub مستقیم (registry-1.docker.io)"
  for m in $DOCKER_MIRROR_CANDIDATES; do
    if [[ " $alive_mirrors " == *" $m "* ]]; then line "موفق" "میرور داکر: $m"; else line "ناموفق" "میرور داکر: $m"; fi
  done
  line "$(st $npm_ok)"    "مخزن npm اصلی (registry.npmjs.org)"
  for m in $NPM_MIRROR_CANDIDATES; do
    if [[ " $npm_alt_ok " == *" $m "* ]]; then line "موفق" "میرور npm: $m"; else line "ناموفق" "میرور npm: $m"; fi
  done
  line "$(st $prisma_ok)" "فایل‌های Prisma (binaries.prisma.sh)"
  line "$(st $debian_ok)" "مخزن Debian برای Chromium (deb.debian.org)"
  line "$(st $gh_ok)"     "GitHub (برای دریافت و به‌روزرسانی برنامه)"
  line "$(st $apt_ok)"    "مخزن apt اوبونتو (${apt_url:-نامشخص})"
  line "$(st $le_ok)"     "Let's Encrypt (برای گواهی HTTPS)"
  printf '\n---------------- تصمیم نصب‌کننده ----------------\n'
  if (( hub_ok == 1 )); then
    printf '  ایمیج‌های داکر مستقیم از Docker Hub گرفته می‌شوند.\n'
  elif [[ -n $alive_mirrors ]]; then
    printf '  Docker Hub در دسترس نیست؛ از این میرورها استفاده می‌شود:\n    %s\n' "$alive_mirrors"
  else
    printf '  هیچ راهی برای گرفتن ایمیج داکر پیدا نشد. بخش «مشکلات رایج» در README.fa.md را ببینید.\n'
  fi
  if (( npm_ok == 1 )); then
    printf '  بسته‌های npm از مخزن اصلی گرفته می‌شوند.\n'
  elif [[ -n $npm_choice ]]; then
    printf '  بسته‌های npm از میرور گرفته می‌شوند: %s\n' "$npm_choice"
  else
    printf '  هیچ مخزن npm در دسترس نیست؛ ساخت برنامه احتمالاً شکست می‌خورد.\n'
  fi
  if [[ -n $prisma_choice ]]; then printf '  فایل‌های Prisma از میرور گرفته می‌شوند: %s\n' "$prisma_choice"; fi
  if [[ -n $debian_choice ]]; then printf '  مخزن Debian داخل ایمیج: %s\n' "$debian_choice"; fi
  if (( gh_ok == 0 )); then printf '  GitHub در دسترس نیست؛ دریافت و به‌روزرسانی برنامه ممکن نیست.\n'; fi
  if (( le_ok == 0 )); then printf '  Let'"'"'s Encrypt در دسترس نیست؛ گواهی HTTPS ممکن است صادر نشود.\n'; fi
  printf '=====================================================\n\n'

  if [[ -n $RESULT_FILE ]]; then
    mkdir -p "$(dirname "$RESULT_FILE")"
    {
      printf 'PF_HUB_OK=%q\n' "$hub_ok"
      printf 'PF_DOCKER_MIRRORS=%q\n' "$alive_mirrors"
      printf 'PF_NPM_REGISTRY=%q\n' "$npm_choice"
      printf 'PF_NPM_OK=%q\n' "$npm_ok"
      printf 'PF_PRISMA_MIRROR=%q\n' "$prisma_choice"
      printf 'PF_DEBIAN_MIRROR=%q\n' "$debian_choice"
      printf 'PF_GITHUB_OK=%q\n' "$gh_ok"
      printf 'PF_LE_OK=%q\n' "$le_ok"
    } >"$RESULT_FILE"
    chmod 600 "$RESULT_FILE"
  fi
  return 0
}

main "$@"; exit $?
