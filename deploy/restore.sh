#!/usr/bin/env bash
# بازگردانی دیتابیس از یک فایل پشتیبان.
# استفاده:  bash /opt/jamal/deploy/restore.sh /var/backups/jamal/jamal-2026-01-01-0230.sql.gz
# هشدار: همه‌ی داده‌های فعلی با محتوای فایل پشتیبان جایگزین می‌شود
# (قبلش خودکار یک پشتیبان ایمنی از وضعیت فعلی گرفته می‌شود).
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SRC_COPY=""
cleanup() {
  if [[ -n $SRC_COPY ]]; then rm -f "$SRC_COPY"; fi
}
trap cleanup EXIT

usage() {
  printf 'استفاده:  bash %s <فایل.sql.gz>\n' "$0"
  printf 'فهرست پشتیبان‌ها:  ls -lh %s\n' "$BACKUP_DIR"
  exit 1
}

main() {
  require_root
  local file="${1:-}"
  [[ -n $file ]] || usage
  [[ -f $file ]] || die "فایل پیدا نشد: $file"
  file="$(readlink -f "$file")"

  info "بررسی سلامت فایل پشتیبان..."
  gzip -t "$file" || die "فایل پشتیبان خراب است یا فایل gzip نیست."
  local tail_text
  tail_text="$(gzip -dc "$file" | tail -n 20)"
  if [[ $tail_text != *"PostgreSQL database dump complete"* ]]; then
    die "این فایل یک پشتیبان کامل دیتابیس نیست (پایان dump پیدا نشد)."
  fi

  acquire_lock 0 || die "عملیات دیگری (پشتیبان‌گیری/به‌روزرسانی) در حال اجراست. چند دقیقه بعد دوباره امتحان کنید."

  # کپی فایل، تا پاک‌سازی خودکار پشتیبان‌های قدیمی آن را از بین نبرد
  SRC_COPY="$(mktemp /var/tmp/jamal-restore-XXXXXX)"
  chmod 600 "$SRC_COPY"
  cp -f "$file" "$SRC_COPY"

  printf '\n'
  printf '==================== هشدار ====================\n'
  printf ' همه‌ی داده‌های فعلی برنامه پاک و با این فایل جایگزین می‌شود:\n'
  printf '   %s  (%s)\n' "$file" "$(du -h "$file" | cut -f1)"
  printf ' قبل از آن یک پشتیبان ایمنی از وضعیت فعلی گرفته می‌شود.\n'
  printf '===============================================\n'
  printf 'برای ادامه کلمه‌ی YES را با حروف بزرگ تایپ کنید و Enter بزنید: '
  local answer=""
  if ! read -r answer </dev/tty; then
    die "ورودی خوانده نشد. این اسکریپت را در ترمینال اجرا کنید."
  fi
  [[ $answer == YES ]] || die "لغو شد. هیچ تغییری انجام نشد."

  # دیتابیس باید روشن باشد
  if ! running_cid db >/dev/null; then
    info "روشن کردن دیتابیس..."
    compose up -d db
  fi
  wait_for_db 180 || die "دیتابیس آماده نشد. لاگ:  bash /opt/jamal/deploy/logs.sh db"

  info "گرفتن پشتیبان ایمنی از وضعیت فعلی..."
  bash "$JAMAL_DEPLOY_DIR/backup.sh" pre-restore \
    || die "پشتیبان ایمنی گرفته نشد؛ برای حفظ داده‌ها بازگردانی انجام نشد."
  local safety
  safety="$(latest_backup pre-restore || true)"

  info "متوقف کردن برنامه..."
  compose stop app

  local db
  db="$(running_cid db)" || die "کانتینر دیتابیس در حال اجرا نیست."

  info "پاک کردن و ساختن دوباره‌ی دیتابیس..."
  docker exec "$db" psql -X -q -U jamal -d postgres -v ON_ERROR_STOP=1 \
    -c 'DROP DATABASE IF EXISTS jamal WITH (FORCE);' \
    -c 'CREATE DATABASE jamal OWNER jamal;' \
    || die "ساخت دوباره‌ی دیتابیس شکست خورد. برنامه خاموش مانده است. پشتیبان ایمنی: ${safety:-نامشخص}"

  info "بازگردانی داده‌ها (ممکن است چند دقیقه طول بکشد)..."
  if ! gzip -dc "$SRC_COPY" | docker exec -i "$db" psql -X -q -U jamal -d jamal -v ON_ERROR_STOP=1 >/dev/null; then
    warn "بازگردانی کامل نشد و برنامه خاموش مانده است."
    warn "برای برگشت به وضعیت قبل از بازگردانی این دستور را بزنید:"
    warn "  bash /opt/jamal/deploy/restore.sh ${safety:-<فایل pre-restore در $BACKUP_DIR>}"
    exit 1
  fi

  info "روشن کردن برنامه..."
  compose up -d app caddy
  if wait_for_app 600; then
    ok "بازگردانی کامل شد و برنامه سالم است."
  else
    warn "داده‌ها بازگردانی شد اما برنامه هنوز سالم گزارش نمی‌شود. لاگ:  bash /opt/jamal/deploy/logs.sh app"
    exit 1
  fi
  if [[ -n $safety ]]; then
    printf 'پشتیبان ایمنی وضعیت قبلی: %s\n' "$safety"
  fi
  return 0
}

main "$@"; exit $?
