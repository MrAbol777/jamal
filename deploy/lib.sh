# shellcheck shell=bash
# توابع مشترک اسکریپت‌های استقرار.
# این فایل را مستقیم اجرا نکنید؛ بقیه‌ی اسکریپت‌ها آن را source می‌کنند.

JAMAL_DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JAMAL_APP_DIR="$(dirname "$JAMAL_DEPLOY_DIR")"
ENV_FILE="$JAMAL_DEPLOY_DIR/.env"
COMPOSE_FILE="$JAMAL_DEPLOY_DIR/docker-compose.yml"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/jamal}"
STATE_DIR="/var/lib/jamal/state"
PROJECT_NAME="jamal"
LOCK_FILE="/run/lock/jamal.lock"
# مرتب‌سازی نام فایل‌ها (تاریخ‌دار) همیشه یکسان باشد
export LC_COLLATE=C

# ---------- پیام‌ها ----------
info() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
ok()   { printf '[انجام شد] %s\n' "$*"; }
warn() { printf '[هشدار] %s\n' "$*" >&2; }
die()  { printf '[خطا] %s\n' "$*" >&2; exit 1; }

require_root() {
  if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
    die "این اسکریپت باید با کاربر root اجرا شود. اول دستور  sudo -i  را بزنید و دوباره امتحان کنید."
  fi
}

# retry <تعداد> <ثانیه‌ی مکث> <دستور...>
retry() {
  local tries=$1 delay=$2 n=1
  shift 2
  until "$@"; do
    if (( n >= tries )); then
      return 1
    fi
    warn "تلاش $n از $tries ناموفق بود؛ $delay ثانیه‌ی دیگر دوباره امتحان می‌شود..."
    sleep "$delay"
    n=$((n + 1))
  done
  return 0
}

# ---------- قفل (جلوگیری از اجرای هم‌زمان پشتیبان‌گیری/بازگردانی/به‌روزرسانی) ----------
# acquire_lock [ثانیه‌ی انتظار]  -> در صورت موفقیت 0
acquire_lock() {
  local wait=${1:-0}
  if [[ ${JAMAL_LOCK_HELD:-} == 1 ]]; then
    return 0
  fi
  mkdir -p "$(dirname "$LOCK_FILE")"
  exec 9>"$LOCK_FILE"
  if (( wait > 0 )); then
    flock -w "$wait" 9 || return 1
  else
    flock -n 9 || return 1
  fi
  export JAMAL_LOCK_HELD=1
  return 0
}

# ---------- docker compose (هر دو نوع: «docker compose» و «docker-compose») ----------
COMPOSE_CMD=()
detect_compose() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
  elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
  else
    return 1
  fi
  return 0
}

compose() {
  if [[ ${#COMPOSE_CMD[@]} -eq 0 ]]; then
    detect_compose || die "docker compose پیدا نشد. اول install.sh را اجرا کنید."
  fi
  [[ -f $ENV_FILE ]] || die "فایل تنظیمات $ENV_FILE وجود ندارد. اول install.sh را اجرا کنید."
  "${COMPOSE_CMD[@]}" -p "$PROJECT_NAME" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

# شناسه‌ی کانتینرِ در حال اجرای یک سرویس (db / app / caddy)
running_cid() {
  local id state
  id="$(compose ps -q "$1" 2>/dev/null || true)"
  id="${id%%$'\n'*}"
  [[ -n $id ]] || return 1
  state="$(docker inspect -f '{{.State.Running}}' "$id" 2>/dev/null || true)"
  [[ $state == true ]] || return 1
  printf '%s' "$id"
}

# سلامت برنامه از داخل کانتینر app (بدون نیاز به curl در ایمیج)
app_health() {
  local id
  id="$(running_cid app)" || return 1
  docker exec "$id" node -e \
    "fetch('http://127.0.0.1:10000/api/health',{signal:AbortSignal.timeout(8000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    >/dev/null 2>&1
}

# wait_for_app [حداکثر ثانیه]
wait_for_app() {
  local timeout=${1:-600} start=$SECONDS
  while (( SECONDS - start < timeout )); do
    if app_health; then
      return 0
    fi
    sleep 5
  done
  return 1
}

# wait_for_db [حداکثر ثانیه]
wait_for_db() {
  local timeout=${1:-180} start=$SECONDS id
  while (( SECONDS - start < timeout )); do
    if id="$(running_cid db)" && docker exec "$id" pg_isready -U jamal -d jamal >/dev/null 2>&1; then
      return 0
    fi
    sleep 3
  done
  return 1
}

# ---------- خواندن/نوشتن deploy/.env ----------
env_get() {
  [[ -f $ENV_FILE ]] || return 0
  local line
  line="$(grep -E "^$1=" "$ENV_FILE" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"
  printf '%s' "$line"
}

env_set() {
  local key=$1 val=$2 tmp
  tmp="$(mktemp "$ENV_FILE.XXXXXX")"
  chmod 600 "$tmp"
  if [[ -f $ENV_FILE ]] && grep -qE "^$key=" "$ENV_FILE"; then
    awk -v k="$key" -v v="$val" 'index($0, k "=") == 1 { print k "=" v; next } { print }' "$ENV_FILE" >"$tmp"
  else
    if [[ -f $ENV_FILE ]]; then
      cat "$ENV_FILE" >"$tmp"
    fi
    printf '%s=%s\n' "$key" "$val" >>"$tmp"
  fi
  mv -f "$tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

# آخرین فایل پشتیبان (اختیاری: با برچسب)
latest_backup() {
  local pattern="jamal-*.sql.gz" f last=""
  if [[ -n ${1:-} ]]; then
    pattern="jamal-*-$1.sql.gz"
  fi
  shopt -s nullglob
  for f in "$BACKUP_DIR"/$pattern; do
    last="$f"
  done
  shopt -u nullglob
  [[ -n $last ]] || return 1
  printf '%s' "$last"
}
