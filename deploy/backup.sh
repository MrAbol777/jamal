#!/usr/bin/env bash
# پشتیبان‌گیری از دیتابیس.
# استفاده:  bash /opt/jamal/deploy/backup.sh  [برچسب]
#   بدون برچسب: پشتیبان روزانه (هر شب ساعت ۲:۳۰ خودکار اجرا می‌شود)
#   با برچسب (مثلاً manual): پشتیبان دستی/ایمنی، جدا نگهداری می‌شود
# خروجی: /var/backups/jamal/jamal-YYYY-MM-DD-HHMM.sql.gz
# نگهداری: ۱۴ پشتیبان روزانه‌ی آخر + آخرین پشتیبانِ هر ماه برای ۶ ماه + ۱۰ پشتیبان برچسب‌دار آخر
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

LOG_FILE="/var/log/jamal-backup.log"
KEEP_DAILY="${KEEP_DAILY:-14}"
KEEP_MONTHLY="${KEEP_MONTHLY:-6}"
KEEP_TAGGED="${KEEP_TAGGED:-10}"

TMP_DUMP=""
TMP_ERR=""
cleanup() {
  if [[ -n $TMP_DUMP ]]; then rm -f "$TMP_DUMP"; fi
  if [[ -n $TMP_ERR ]]; then rm -f "$TMP_ERR"; fi
}
trap cleanup EXIT

blog() {
  local msg
  msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  printf '%s\n' "$msg"
  printf '%s\n' "$msg" >>"$LOG_FILE" 2>/dev/null || true
}
fail() {
  blog "خطا: $*"
  exit 1
}

prune_backups() {
  local -a daily=() tagged=()
  local -A keep=() seen=()
  local f base i n months=0 m
  shopt -s nullglob
  for f in "$BACKUP_DIR"/jamal-*.sql.gz; do
    base="${f##*/}"
    if [[ $base =~ ^jamal-[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4,6}\.sql\.gz$ ]]; then
      daily+=("$base")
    elif [[ $base =~ ^jamal-[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{4,6}-[a-z0-9-]+\.sql\.gz$ ]]; then
      tagged+=("$base")
    fi
  done
  shopt -u nullglob

  # daily مرتب (قدیمی به جدید) است؛ ۱۴ تای آخر
  n=${#daily[@]}
  for (( i = n - 1; i >= 0 && i >= n - KEEP_DAILY; i-- )); do
    keep[${daily[i]}]=1
  done
  # آخرین پشتیبانِ هر ماه، برای ۶ ماه اخیر
  for (( i = n - 1; i >= 0; i-- )); do
    m="${daily[i]:6:7}"   # YYYY-MM
    if [[ -z ${seen[$m]:-} ]]; then
      if (( months >= KEEP_MONTHLY )); then
        break
      fi
      seen[$m]=1
      months=$((months + 1))
      keep[${daily[i]}]=1
    fi
  done
  for base in "${daily[@]}"; do
    if [[ -z ${keep[$base]:-} ]]; then
      rm -f -- "$BACKUP_DIR/$base"
      blog "پشتیبان قدیمی حذف شد: $base"
    fi
  done

  n=${#tagged[@]}
  for (( i = 0; i < n - KEEP_TAGGED; i++ )); do
    rm -f -- "$BACKUP_DIR/${tagged[i]}"
    blog "پشتیبان برچسب‌دار قدیمی حذف شد: ${tagged[i]}"
  done
}

main() {
  require_root
  local tag="${1:-}"
  if [[ -n $tag && ! $tag =~ ^[a-z0-9-]+$ ]]; then
    fail "برچسب فقط می‌تواند حروف کوچک انگلیسی، عدد و - باشد."
  fi

  touch "$LOG_FILE" 2>/dev/null && chmod 600 "$LOG_FILE" 2>/dev/null || true
  acquire_lock 1800 || fail "عملیات دیگری (به‌روزرسانی/بازگردانی) در حال اجراست؛ پشتیبان‌گیری انجام نشد."

  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"

  local db
  db="$(running_cid db)" || fail "کانتینر دیتابیس در حال اجرا نیست. وضعیت را با  bash /opt/jamal/deploy/status.sh  ببینید."

  local stamp name final
  stamp="$(date +%Y-%m-%d-%H%M)"
  name="jamal-$stamp${tag:+-$tag}.sql.gz"
  final="$BACKUP_DIR/$name"
  if [[ -e $final ]]; then
    stamp="$(date +%Y-%m-%d-%H%M%S)"
    name="jamal-$stamp${tag:+-$tag}.sql.gz"
    final="$BACKUP_DIR/$name"
  fi

  TMP_DUMP="$(mktemp "$BACKUP_DIR/.tmp-backup-XXXXXX")"
  TMP_ERR="$(mktemp)"
  chmod 600 "$TMP_DUMP"

  blog "شروع پشتیبان‌گیری: $name"
  if ! docker exec "$db" pg_dump -U jamal -d jamal --no-owner --no-privileges 2>"$TMP_ERR" | gzip -6 >"$TMP_DUMP"; then
    cat "$TMP_ERR" >>"$LOG_FILE" 2>/dev/null || true
    cat "$TMP_ERR" >&2 || true
    fail "دستور pg_dump شکست خورد."
  fi

  # بررسی سلامت فایل
  [[ -s $TMP_DUMP ]] || fail "فایل پشتیبان خالی است."
  gzip -t "$TMP_DUMP" || fail "فایل پشتیبان خراب است (gzip -t)."
  local tail_text
  tail_text="$(gzip -dc "$TMP_DUMP" | tail -n 20)"
  [[ $tail_text == *"PostgreSQL database dump complete"* ]] || fail "فایل پشتیبان کامل نیست (پایان dump پیدا نشد)."

  # جابه‌جایی اتمی به نام نهایی
  mv -f "$TMP_DUMP" "$final"
  TMP_DUMP=""
  sync "$final" 2>/dev/null || sync

  local size
  size="$(du -h "$final" | cut -f1)"
  blog "پشتیبان با موفقیت ساخته شد: $final ($size)"

  prune_backups

  # هشدار کمبود فضای دیسک (کمتر از ۱ گیگابایت)
  local free_kb
  free_kb="$(df -Pk "$BACKUP_DIR" | awk 'NR==2 {print $4}')"
  if [[ $free_kb =~ ^[0-9]+$ ]] && (( free_kb < 1048576 )); then
    blog "هشدار: فضای خالی دیسک کمتر از ۱ گیگابایت است."
  fi
  return 0
}

main "$@"; exit $?
