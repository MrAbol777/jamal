#!/usr/bin/env bash
# نصب کامل برنامه‌ی جمال روی Ubuntu 22.04 یا 24.04 (با کاربر root).
#
#   bash install.sh example.ir      با دامنه و HTTPS خودکار
#   bash install.sh                 بدون دامنه (سایت با http://IP باز می‌شود)
#   bash install.sh --no-domain     برگشت از حالت دامنه به حالت IP
#
# دوباره اجرا کردن آن بی‌خطر است: داده‌ها، رمزها و فایل .env حفظ می‌شوند.
# اگر وسط کار قطع شد، همان دستور را دوباره اجرا کنید.
# گزارش کامل نصب: /var/log/jamal-install.log
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

TARGET_DIR="${JAMAL_DIR:-/opt/jamal}"
GIT_URL="${GIT_URL:-https://github.com/MrAbol777/jamal.git}"
GIT_BRANCH="${GIT_BRANCH:-main}"
INSTALL_LOG="/var/log/jamal-install.log"
ENV_BACKUP="/root/.jamal-env.backup"
DEFAULT_DATA_DIR="/var/lib/jamal"
PREFLIGHT_FILE="$STATE_DIR/preflight.env"
IMAGES=(caddy:2-alpine postgres:16-alpine node:22-slim)

export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a GIT_TERMINAL_PROMPT=0 BUILDKIT_PROGRESS=plain

APT_OPTS=(-y
  -o Acquire::Retries=5
  -o Acquire::http::Timeout=30
  -o Acquire::https::Timeout=30
  -o DPkg::Lock::Timeout=600
  -o Dpkg::Options::=--force-confdef
  -o Dpkg::Options::=--force-confold)

DOMAIN_ARG=""
NO_DOMAIN=0

# ---------------------------------------------------------------- کمکی‌ها
usage() {
  printf 'استفاده:\n'
  printf '  bash install.sh example.ir     (با دامنه)\n'
  printf '  bash install.sh                (بدون دامنه، با IP)\n'
  printf '  bash install.sh --no-domain    (حذف دامنه‌ی قبلی)\n'
  exit 1
}

step() { printf '\n========== %s ==========\n' "$*"; }

apt_update()  { retry 3 15 apt-get "${APT_OPTS[@]}" update; }
apt_install() { retry 2 10 apt-get "${APT_OPTS[@]}" install "$@"; }

parse_args() {
  local a
  for a in "$@"; do
    case "$a" in
      --no-domain|--ip) NO_DOMAIN=1 ;;
      -h|--help) usage ;;
      -*) warn "گزینه‌ی ناشناخته: $a"; usage ;;
      *)
        [[ -z $DOMAIN_ARG ]] || die "فقط یک دامنه می‌توانید بدهید."
        DOMAIN_ARG="$a"
        ;;
    esac
  done
  if [[ -n $DOMAIN_ARG ]]; then
    DOMAIN_ARG="${DOMAIN_ARG,,}"
    DOMAIN_ARG="${DOMAIN_ARG#http://}"
    DOMAIN_ARG="${DOMAIN_ARG#https://}"
    DOMAIN_ARG="${DOMAIN_ARG%%/*}"
    if [[ ! $DOMAIN_ARG =~ ^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]{2,}$ ]]; then
      die "دامنه‌ی نامعتبر: $DOMAIN_ARG   (نمونه‌ی درست: example.ir)"
    fi
  fi
  if (( NO_DOMAIN == 1 )) && [[ -n $DOMAIN_ARG ]]; then
    die "--no-domain و دامنه را با هم ندهید."
  fi
}

setup_logging() {
  touch "$INSTALL_LOG"
  chmod 600 "$INSTALL_LOG"
  exec > >(tee -a "$INSTALL_LOG") 2>&1
  printf '\n----- شروع نصب: %s -----\n' "$(date '+%Y-%m-%d %H:%M:%S')"
}

check_os() {
  local id ver
  id="$(. /etc/os-release && printf '%s' "${ID:-}")"
  ver="$(. /etc/os-release && printf '%s' "${VERSION_ID:-}")"
  if [[ $id != ubuntu ]]; then
    warn "این اسکریپت برای Ubuntu نوشته شده است (سیستم فعلی: $id $ver). ادامه با مسئولیت خودتان."
  elif [[ $ver != 22.04 && $ver != 24.04 ]]; then
    warn "فقط Ubuntu 22.04 و 24.04 آزمایش شده‌اند (نسخه‌ی فعلی: $ver)."
  fi
  if [[ $(uname -m) != x86_64 ]]; then
    warn "معماری سرور $(uname -m) است؛ فقط x86_64 (amd64) آزمایش شده است."
  fi
}

bootstrap_packages() {
  local need=() p
  for p in curl git ca-certificates openssl python3; do
    if ! dpkg -s "$p" >/dev/null 2>&1; then need+=("$p"); fi
  done
  if (( ${#need[@]} > 0 )); then
    info "نصب ابزارهای اولیه: ${need[*]}"
    apt_update || die "apt-get update ناموفق بود. اینترنت/مخزن apt سرور را بررسی کنید."
    apt_install "${need[@]}" || die "نصب ابزارهای اولیه ناموفق بود."
  fi
}

clone_repo() {
  rm -rf "$TARGET_DIR.tmp"
  timeout 900 git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=60 \
    clone -q --branch "$GIT_BRANCH" "$GIT_URL" "$TARGET_DIR.tmp" || return 1
  mv "$TARGET_DIR.tmp" "$TARGET_DIR"
}

# کد برنامه را در /opt/jamal می‌گذارد/به‌روز می‌کند و نسخه‌ی همان‌جا را اجرا می‌کند
ensure_repo() {
  if [[ -d $TARGET_DIR/.git ]]; then
    info "به‌روزرسانی کد برنامه در $TARGET_DIR ..."
    if [[ -n "$(git -C "$TARGET_DIR" status --porcelain --untracked-files=no)" ]]; then
      warn "فایل‌های برنامه دستی تغییر کرده‌اند؛ git pull انجام نشد و با همین نسخه ادامه می‌دهیم."
    elif ! retry 3 15 timeout 300 git -C "$TARGET_DIR" -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=60 \
        pull -q --ff-only origin "$GIT_BRANCH"; then
      warn "دریافت آخرین نسخه از GitHub ممکن نشد؛ با نسخه‌ی موجود ادامه می‌دهیم."
    fi
  elif [[ -e $TARGET_DIR ]]; then
    die "$TARGET_DIR وجود دارد ولی مخزن git نیست. آن را جابه‌جا کنید یا با JAMAL_DIR مسیر دیگری بدهید."
  else
    info "دریافت برنامه از $GIT_URL ..."
    retry 4 20 clone_repo || die "دریافت برنامه از GitHub ممکن نشد. بخش «مشکلات رایج» در راهنما را ببینید."
  fi
  [[ -f $TARGET_DIR/deploy/install.sh ]] \
    || die "فایل deploy/install.sh در مخزن نیست؛ احتمالاً فایل‌های استقرار هنوز در GitHub قرار نگرفته‌اند."
  export JAMAL_INSTALL_REEXEC=1
  exec bash "$TARGET_DIR/deploy/install.sh" "$@"
}

run_preflight() {
  PF_HUB_OK=0 PF_DOCKER_MIRRORS="" PF_NPM_REGISTRY="" PF_NPM_OK=0
  PF_PRISMA_MIRROR="" PF_DEBIAN_MIRROR="" PF_GITHUB_OK=0 PF_LE_OK=0
  mkdir -p "$STATE_DIR"
  chmod 700 "$STATE_DIR"
  if bash "$JAMAL_DEPLOY_DIR/preflight.sh" "$PREFLIGHT_FILE" && [[ -f $PREFLIGHT_FILE ]]; then
    # shellcheck disable=SC1090
    source "$PREFLIGHT_FILE"
  else
    warn "بررسی شبکه کامل انجام نشد؛ با تنظیمات پیش‌فرض ادامه می‌دهیم."
  fi
}

system_packages() {
  apt_update || die "apt-get update ناموفق بود. اینترنت/مخزن apt سرور را بررسی کنید."
  info "به‌روزرسانی بسته‌های سیستم (ممکن است چند دقیقه طول بکشد)..."
  apt-get "${APT_OPTS[@]}" upgrade || warn "به‌روزرسانی کامل بسته‌ها انجام نشد؛ ادامه می‌دهیم."
  apt_install curl git ufw cron openssl ca-certificates python3 tzdata gzip util-linux \
    || die "نصب بسته‌های لازم ناموفق بود."
  apt_install unattended-upgrades fail2ban || warn "نصب unattended-upgrades یا fail2ban ناموفق بود."

  if dpkg -s unattended-upgrades >/dev/null 2>&1 && [[ ! -f /etc/apt/apt.conf.d/20auto-upgrades ]]; then
    printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' \
      >/etc/apt/apt.conf.d/20auto-upgrades
  fi
  if dpkg -s fail2ban >/dev/null 2>&1; then
    systemctl enable --now fail2ban >/dev/null 2>&1 || warn "fail2ban روشن نشد."
  fi
  systemctl enable --now cron >/dev/null 2>&1 || warn "سرویس cron روشن نشد."

  if [[ ${KEEP_TZ:-0} != 1 ]] && command -v timedatectl >/dev/null 2>&1; then
    timedatectl set-timezone Asia/Tehran >/dev/null 2>&1 || warn "تنظیم منطقه‌ی زمانی تهران ممکن نشد."
  fi
}

make_swapfile() {
  local f=/swapfile
  rm -f "$f"
  if ! fallocate -l 2G "$f" 2>/dev/null; then
    dd if=/dev/zero of="$f" bs=1M count=2048 status=none || return 1
  fi
  chmod 600 "$f" || return 1
  mkswap "$f" >/dev/null || return 1
  swapon "$f" 2>/dev/null
}

setup_swap() {
  local mem_kb
  mem_kb="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
  if (( mem_kb >= 3 * 1024 * 1024 )); then
    info "حافظه‌ی RAM کافی است؛ swap لازم نیست."
    return 0
  fi
  if [[ -n "$(swapon --noheadings --show 2>/dev/null || true)" ]]; then
    info "swap از قبل فعال است."
    return 0
  fi
  info "ساخت فایل swap دو گیگابایتی (برای ساخت برنامه و Chromium لازم است)..."
  if ! make_swapfile; then
    # روی بعضی فایل‌سیستم‌ها fallocate فایل مناسب swap نمی‌سازد؛ یک بار با dd
    rm -f /swapfile
    if ! { dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none && chmod 600 /swapfile \
           && mkswap /swapfile >/dev/null && swapon /swapfile 2>/dev/null; }; then
      rm -f /swapfile
      warn "ساخت swap روی این سرور ممکن نشد (بعضی سرورهای مجازی اجازه نمی‌دهند)."
      warn "اگر ساخت برنامه یا PDF با کمبود حافظه شکست خورد، سرور با RAM بیشتر بگیرید."
      return 0
    fi
  fi
  if ! grep -qE '^/swapfile[[:space:]]' /etc/fstab; then
    printf '/swapfile none swap sw 0 0\n' >>/etc/fstab
  fi
  printf 'vm.swappiness=10\n' >/etc/sysctl.d/99-jamal-swap.conf
  sysctl -q -p /etc/sysctl.d/99-jamal-swap.conf >/dev/null 2>&1 || true
  ok "swap فعال شد."
}

install_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    info "نصب Docker از مخزن خود اوبونتو (docker.io)..."
    apt_install docker.io || die "نصب docker.io ناموفق بود."
  else
    info "Docker از قبل نصب است."
  fi
  systemctl enable --now docker >/dev/null 2>&1 || systemctl start docker || die "سرویس Docker روشن نشد."

  if ! detect_compose; then
    local pkg
    for pkg in docker-compose-v2 docker-compose-plugin; do
      info "نصب $pkg ..."
      if apt_install "$pkg" >/dev/null 2>&1 && detect_compose; then
        break
      fi
    done
  fi
  if ! detect_compose; then
    warn "Compose v2 پیدا نشد؛ نسخه‌ی قدیمی docker-compose نصب می‌شود."
    apt_install docker-compose >/dev/null 2>&1 || true
  fi
  detect_compose || die "نصب docker compose ممکن نشد."

  if ! docker buildx version >/dev/null 2>&1; then
    apt_install docker-buildx >/dev/null 2>&1 || warn "docker-buildx نصب نشد؛ از سازنده‌ی قدیمی Docker استفاده می‌شود."
  fi
  ok "$(docker --version)  |  ${COMPOSE_CMD[*]}"
}

# تنظیم /etc/docker/daemon.json : چرخش لاگ‌ها + (در صورت نیاز) میرورهای داکر هاب
configure_docker_daemon() {
  local mirrors="${1:-}" file=/etc/docker/daemon.json before after
  mkdir -p /etc/docker
  before="$(cat "$file" 2>/dev/null || true)"
  if [[ -f $file ]] && ! python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$file" 2>/dev/null; then
    cp -f "$file" "$file.bak.$(date +%s)"
    warn "فایل $file خراب بود؛ نسخه‌ی پشتیبان آن کنارش ذخیره شد."
    rm -f "$file"
  fi
  python3 - "$file" "$mirrors" <<'PY'
import json, os, sys
path, mirrors = sys.argv[1], [m for m in sys.argv[2].split() if m]
data = {}
if os.path.exists(path):
    with open(path) as fh:
        data = json.load(fh)
data.setdefault("log-driver", "json-file")
data.setdefault("log-opts", {"max-size": "10m", "max-file": "3"})
if mirrors:
    data["registry-mirrors"] = mirrors
tmp = path + ".tmp"
with open(tmp, "w") as fh:
    json.dump(data, fh, indent=2)
    fh.write("\n")
os.replace(tmp, path)
PY
  after="$(cat "$file")"
  if [[ $before != "$after" ]]; then
    info "راه‌اندازی دوباره‌ی Docker با تنظیمات جدید..."
    systemctl restart docker || die "Docker با تنظیمات جدید بالا نیامد. فایل $file را بررسی کنید."
    sleep 3
    docker info >/dev/null 2>&1 || die "Docker پاسخ نمی‌دهد."
  fi
}

pull_image() {
  info "دریافت ایمیج $1 ..."
  timeout 900 docker pull -q "$1" >/dev/null 2>&1
}

pull_all() {
  local prefix=$1 img
  for img in "${IMAGES[@]}"; do
    retry 2 10 pull_image "$prefix$img" || return 1
  done
  return 0
}

images_present() {
  local prefix=$1 img
  for img in "${IMAGES[@]}"; do
    docker image inspect "$prefix$img" >/dev/null 2>&1 || return 1
  done
  return 0
}

# انتخاب راه گرفتن ایمیج‌ها: مستقیم، میرور daemon، یا پیشوند IMAGE_PREFIX
choose_images() {
  local user_prefix mirrors m host p
  configure_docker_daemon ""
  user_prefix="$(env_get IMAGE_PREFIX)"
  if [[ -n $user_prefix ]]; then
    info "استفاده از IMAGE_PREFIX=$user_prefix (از فایل .env)"
    if pull_all "$user_prefix"; then return 0; fi
    if images_present "$user_prefix"; then
      warn "دریافت ایمیج‌ها ممکن نشد ولی نسخه‌ی قبلی آن‌ها روی سرور هست؛ ادامه می‌دهیم."
      return 0
    fi
    die "دریافت ایمیج با IMAGE_PREFIX=$user_prefix ممکن نشد. مقدار دیگری در $ENV_FILE بگذارید یا خالی کنید (راهنما را ببینید)."
  fi

  if [[ ${PF_HUB_OK:-0} == 1 ]]; then
    info "دریافت مستقیم از Docker Hub..."
    if pull_all ""; then return 0; fi
    warn "دریافت مستقیم از Docker Hub ممکن نشد."
  fi

  # فقط میرورهایی که در بررسی شبکه زنده بودند (فهرست نامزدها با DOCKER_MIRRORS قابل تغییر است)
  mirrors="${PF_DOCKER_MIRRORS:-}"
  if [[ -n $mirrors ]]; then
    info "تنظیم میرورهای داکر هاب: $mirrors"
    configure_docker_daemon "$mirrors"
    if pull_all ""; then return 0; fi
    warn "دریافت از طریق registry-mirrors ممکن نشد؛ امتحان با پیشوند نام ایمیج..."
    for m in $mirrors; do
      host="${m#https://}"
      host="${host#http://}"
      host="${host%/}"
      for p in "$host/" "$host/library/"; do
        if pull_all "$p"; then
          env_set IMAGE_PREFIX "$p"
          cp -f "$ENV_FILE" "$ENV_BACKUP"
          ok "ایمیج‌ها با پیشوند $p گرفته شدند (در .env ذخیره شد)."
          return 0
        fi
      done
    done
  fi

  if images_present ""; then
    warn "دریافت ایمیج‌ها ممکن نشد ولی نسخه‌ی قبلی آن‌ها روی سرور هست؛ ادامه می‌دهیم."
    return 0
  fi
  die "هیچ راهی برای دریافت ایمیج‌های داکر پیدا نشد. بخش «دریافت ایمیج داکر ممکن نیست» در deploy/README.fa.md را ببینید."
}

setup_firewall() {
  if ! command -v ufw >/dev/null 2>&1; then
    warn "ufw نصب نیست؛ فایروال تنظیم نشد."
    return 0
  fi
  local ports="22" p
  for p in $( { sshd -T 2>/dev/null || true; } | awk '$1 == "port" {print $2}'); do
    if [[ $p =~ ^[0-9]+$ && " $ports " != *" $p "* ]]; then ports="$ports $p"; fi
  done
  for p in $ports; do
    ufw allow "$p/tcp" >/dev/null || warn "باز کردن پورت $p ممکن نشد."
  done
  ufw allow 80/tcp >/dev/null || true
  ufw allow 443/tcp >/dev/null || true
  ufw allow 443/udp >/dev/null || true
  ufw default deny incoming >/dev/null || true
  ufw default allow outgoing >/dev/null || true
  if ufw --force enable >/dev/null; then
    ok "فایروال فعال شد (پورت‌های باز: $ports 80 443)."
  else
    warn "فعال کردن فایروال ممکن نشد."
  fi
}

data_dir() {
  local d
  d="$(env_get DATA_DIR)"
  printf '%s' "${d:-$DEFAULT_DATA_DIR}"
}

db_data_exists() {
  local d
  d="$(data_dir)/postgres"
  [[ -d $d && -n "$(ls -A "$d" 2>/dev/null)" ]]
}

write_env() {
  if [[ ! -f $ENV_FILE ]]; then
    if [[ -f $ENV_BACKUP ]]; then
      cp -f "$ENV_BACKUP" "$ENV_FILE"
      warn "فایل .env از نسخه‌ی پشتیبان $ENV_BACKUP برگردانده شد."
    elif db_data_exists; then
      die "دیتابیس قبلی در $(data_dir)/postgres هست ولی فایل $ENV_FILE (رمز دیتابیس) گم شده است. فایل .env قبلی را برگردانید."
    elif [[ -f $JAMAL_DEPLOY_DIR/.env.example ]]; then
      cp -f "$JAMAL_DEPLOY_DIR/.env.example" "$ENV_FILE"
    else
      printf '# تنظیمات سرور برنامه‌ی جمال (ساخته‌شده با install.sh). این فایل را به کسی ندهید.\n' >"$ENV_FILE"
    fi
  fi
  chmod 600 "$ENV_FILE"

  local v
  if [[ -z "$(env_get DB_PASSWORD)" ]]; then
    if db_data_exists; then
      die "DB_PASSWORD در $ENV_FILE خالی است ولی دیتابیس قبلاً ساخته شده. رمز قبلی را در فایل بگذارید."
    fi
    v="$(openssl rand -hex 24)"
    [[ ${#v} -eq 48 ]] || die "ساخت رمز تصادفی ممکن نشد."
    env_set DB_PASSWORD "$v"
  fi
  if [[ -z "$(env_get SESSION_SECRET)" ]]; then
    v="$(openssl rand -hex 48)"
    [[ ${#v} -eq 96 ]] || die "ساخت کلید تصادفی ممکن نشد."
    env_set SESSION_SECRET "$v"
  fi
  v=""

  if (( NO_DOMAIN == 1 )); then
    env_set DOMAIN ""
    env_set SITE_ADDRESS ":80"
    env_set COOKIE_SECURE "0"
  elif [[ -n $DOMAIN_ARG ]]; then
    env_set DOMAIN "$DOMAIN_ARG"
    env_set SITE_ADDRESS "$DOMAIN_ARG"
    env_set COOKIE_SECURE "1"
  elif [[ -z "$(env_get DOMAIN)" ]]; then
    env_set SITE_ADDRESS ":80"
    env_set COOKIE_SECURE "0"
  fi

  # میرورها: فقط اگر کاربر خودش چیزی نگذاشته باشد
  if [[ -z "$(env_get NPM_REGISTRY)" && -n ${PF_NPM_REGISTRY:-} ]]; then env_set NPM_REGISTRY "$PF_NPM_REGISTRY"; fi
  if [[ -z "$(env_get PRISMA_ENGINES_MIRROR)" && -n ${PF_PRISMA_MIRROR:-} ]]; then env_set PRISMA_ENGINES_MIRROR "$PF_PRISMA_MIRROR"; fi
  if [[ -z "$(env_get DEBIAN_MIRROR)" && -n ${PF_DEBIAN_MIRROR:-} ]]; then env_set DEBIAN_MIRROR "$PF_DEBIAN_MIRROR"; fi
  grep -qE '^IMAGE_PREFIX=' "$ENV_FILE" || env_set IMAGE_PREFIX ""
  [[ -n "$(env_get DATA_DIR)" ]] || env_set DATA_DIR "$DEFAULT_DATA_DIR"
  [[ -n "$(env_get APP_TZ)" ]] || env_set APP_TZ "Asia/Tehran"

  cp -f "$ENV_FILE" "$ENV_BACKUP"
  chmod 600 "$ENV_BACKUP"
  ok "فایل تنظیمات آماده است: $ENV_FILE (یک نسخه‌ی پشتیبان در $ENV_BACKUP)"
}

prepare_dirs() {
  local d
  d="$(data_dir)"
  mkdir -p "$d/postgres" "$d/caddy/data" "$d/caddy/config" "$STATE_DIR" "$BACKUP_DIR"
  chmod 700 "$d" "$BACKUP_DIR" "$STATE_DIR"
}

public_ip() {
  local u ip
  for u in https://api.ipify.org https://ifconfig.me/ip https://icanhazip.com; do
    ip="$(curl -4 -fsS --max-time 8 "$u" 2>/dev/null | tr -d '[:space:]' || true)"
    if [[ $ip =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      printf '%s' "$ip"
      return 0
    fi
  done
  ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  printf '%s' "$ip"
}

check_dns() {
  local domain=$1 ip=$2 resolved
  resolved="$(getent ahostsv4 "$domain" 2>/dev/null | awk 'NR == 1 {print $1}' || true)"
  if [[ -z $resolved ]]; then
    warn "دامنه‌ی $domain هنوز به هیچ IP اشاره نمی‌کند. رکورد A آن را روی $ip بگذارید؛ گواهی HTTPS بعد از آن خودکار گرفته می‌شود."
  elif [[ -n $ip && $resolved != "$ip" ]]; then
    warn "دامنه‌ی $domain به $resolved اشاره می‌کند ولی IP این سرور $ip است. رکورد A را درست کنید."
  else
    ok "دامنه‌ی $domain درست به این سرور اشاره می‌کند."
  fi
  if [[ ${PF_LE_OK:-1} != 1 ]]; then
    warn "Let's Encrypt از این سرور در دسترس نبود؛ ممکن است گواهی HTTPS صادر نشود."
  fi
}

build_and_start() {
  info "ساخت ایمیج برنامه (بار اول ۱۰ تا ۲۰ دقیقه طول می‌کشد؛ صبر کنید)..."
  if ! compose build app; then
    die "ساخت برنامه شکست خورد. اگر خطا درباره‌ی npm/prisma/debian یا timeout است، بخش «مشکلات رایج» راهنما را ببینید. گزارش: $INSTALL_LOG"
  fi
  info "روشن کردن سرویس‌ها..."
  compose up -d || die "روشن کردن سرویس‌ها ناموفق بود."
  info "منتظر آماده شدن برنامه (اجرای مایگریشن دیتابیس)..."
  if ! wait_for_app 900; then
    compose logs --tail 80 app || true
    die "برنامه بالا نیامد. لاگ بالا را ببینید یا:  bash $JAMAL_DEPLOY_DIR/logs.sh app"
  fi
  ok "برنامه سالم است."
}

create_admin() {
  local login="$JAMAL_APP_DIR/ADMIN-LOGIN.txt" db app count pw url=$1
  db="$(running_cid db)" || die "کانتینر دیتابیس در حال اجرا نیست."
  count="$(docker exec "$db" psql -X -tA -U jamal -d jamal -c "SELECT count(*) FROM \"User\" WHERE username = 'admin';")" \
    || die "خواندن جدول کاربران ممکن نشد."
  count="${count//[[:space:]]/}"
  if [[ $count != 0 ]]; then
    if [[ -f $login ]]; then
      ok "کاربر admin از قبل وجود دارد؛ اطلاعات ورود در $login است."
    else
      warn "کاربر admin از قبل وجود دارد (نصب یا بازگردانی قبلی) و رمز آن تغییر نکرد."
    fi
    return 0
  fi

  pw="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9')"
  pw="${pw:0:16}"
  [[ ${#pw} -eq 16 ]] || die "ساخت رمز تصادفی ممکن نشد."
  app="$(running_cid app)" || die "کانتینر برنامه در حال اجرا نیست."

  (
    umask 077
    cat >"$login" <<EOF
اطلاعات ورود به برنامه‌ی جمال
==============================
آدرس:        $url
نام کاربری:  admin
رمز عبور:    $pw

بعد از اولین ورود، از صفحه‌ی «تنظیمات» رمز را عوض کنید
و بعد این فایل را پاک کنید:  rm $login
این فایل را برای کسی نفرستید.
EOF
  )
  chmod 600 "$login"

  # رمز از راه stdin داده می‌شود تا در لاگ و فهرست پردازه‌ها دیده نشود
  if ! printf '%s' "$pw" | docker exec -i "$app" sh -c \
      'export ADMIN_PASSWORD="$(cat)" ADMIN_USERNAME=admin SEED_DEMO=0; npx tsx prisma/seed.ts' >/dev/null; then
    rm -f "$login"
    die "ساخت کاربر admin ناموفق بود. نصب را دوباره اجرا کنید."
  fi
  pw=""
  ok "کاربر admin ساخته شد. رمز در فایل $login است."
}

install_cron() {
  cat >/etc/cron.d/jamal-backup <<EOF
# Nightly database backup of the Jamal app (see $JAMAL_DEPLOY_DIR/backup.sh)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 2 * * * root /bin/bash $JAMAL_DEPLOY_DIR/backup.sh >/dev/null 2>&1
EOF
  cat >/etc/cron.d/jamal-docker-prune <<'EOF'
# Weekly cleanup of unused Docker images and old build cache (data volumes are NOT touched)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 4 * * 0 root docker image prune -f >/dev/null 2>&1; docker builder prune -f --filter until=168h >/dev/null 2>&1; true
EOF
  chmod 644 /etc/cron.d/jamal-backup /etc/cron.d/jamal-docker-prune
  if [[ -d /etc/logrotate.d ]]; then
    cat >/etc/logrotate.d/jamal <<'EOF'
/var/log/jamal-backup.log /var/log/jamal-install.log {
    monthly
    rotate 12
    compress
    missingok
    notifempty
    create 600 root root
}
EOF
  fi
  ok "پشتیبان‌گیری شبانه (ساعت ۲:۳۰) و پاک‌سازی هفتگی تنظیم شد."
}

final_message() {
  local url=$1 login="$JAMAL_APP_DIR/ADMIN-LOGIN.txt"
  printf '\n'
  printf '==============================================================\n'
  printf '  نصب با موفقیت تمام شد.\n'
  printf '==============================================================\n'
  printf '  آدرس برنامه:   %s\n' "$url"
  if [[ -f $login ]]; then
    printf '  نام کاربری و رمز اولیه در این فایل است:\n'
    printf '      %s\n' "$login"
    printf '  برای دیدن آن این دستور را بزنید:\n'
    printf '      cat %s\n' "$login"
  fi
  printf '  بعد از ورود، از صفحه‌ی «تنظیمات» رمز را عوض کنید.\n'
  printf '\n'
  printf '  پشتیبان خودکار:  هر شب ساعت ۲:۳۰ در پوشه‌ی %s\n' "$BACKUP_DIR"
  printf '  حتماً هر هفته پشتیبان‌ها را روی کامپیوتر خودتان کپی کنید (راهنما).\n'
  printf '\n'
  printf '  وضعیت:          bash %s/status.sh\n' "$JAMAL_DEPLOY_DIR"
  printf '  پشتیبان دستی:   bash %s/backup.sh manual\n' "$JAMAL_DEPLOY_DIR"
  printf '  به‌روزرسانی:     bash %s/update.sh\n' "$JAMAL_DEPLOY_DIR"
  printf '  لاگ برنامه:     bash %s/logs.sh app\n' "$JAMAL_DEPLOY_DIR"
  printf '  راهنمای کامل:   %s/README.fa.md\n' "$JAMAL_DEPLOY_DIR"
  if [[ -f /var/run/reboot-required ]]; then
    printf '\n  سیستم‌عامل به‌روز شده و یک بار ری‌استارت لازم دارد. هر وقت مناسب بود:  reboot\n'
    printf '  (برنامه بعد از ری‌استارت خودکار بالا می‌آید.)\n'
  fi
  printf '==============================================================\n'
}

# ---------------------------------------------------------------- اصلی
main() {
  require_root
  parse_args "$@"

  if [[ ${JAMAL_INSTALL_REEXEC:-} != 1 ]]; then
    setup_logging
    check_os
    step "آماده‌سازی"
    bootstrap_packages
    ensure_repo "$@"   # این تابع با نسخه‌ی /opt/jamal دوباره اجرا می‌شود و برنمی‌گردد
  fi

  step "۱) بررسی شبکه"
  run_preflight

  step "۲) بسته‌های سیستم"
  system_packages

  step "۳) حافظه‌ی swap"
  setup_swap

  step "۴) Docker"
  install_docker

  step "۵) فایروال"
  setup_firewall

  step "۶) فایل تنظیمات"
  write_env
  prepare_dirs

  step "۷) دریافت ایمیج‌های داکر"
  choose_images

  local domain ip url
  domain="$(env_get DOMAIN)"
  ip="$(public_ip)"
  if [[ -n $domain ]]; then
    url="https://$domain"
    check_dns "$domain" "$ip"
  else
    url="http://${ip:-IP-سرور}"
  fi

  step "۸) ساخت و اجرای برنامه"
  build_and_start

  step "۹) کاربر مدیر"
  create_admin "$url"

  step "۱۰) پشتیبان‌گیری خودکار"
  install_cron
  info "گرفتن اولین پشتیبان برای آزمایش..."
  bash "$JAMAL_DEPLOY_DIR/backup.sh" install || warn "اولین پشتیبان‌گیری ناموفق بود؛ گزارش: /var/log/jamal-backup.log"

  final_message "$url"
  return 0
}

main "$@"; exit $?
