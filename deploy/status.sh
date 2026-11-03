#!/usr/bin/env bash
# نمایش وضعیت سرور و برنامه.
# استفاده:  bash /opt/jamal/deploy/status.sh
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

main() {
  require_root

  printf '\n===== وضعیت سرویس‌ها =====\n'
  compose ps || true

  printf '\n===== سلامت برنامه =====\n'
  if app_health; then
    printf 'برنامه سالم است.\n'
  else
    printf 'برنامه پاسخ نمی‌دهد! لاگ:  bash /opt/jamal/deploy/logs.sh app\n'
  fi

  printf '\n===== نسخه‌ی برنامه =====\n'
  git -C "$JAMAL_APP_DIR" log -1 --format='%h  %ci  %s' 2>/dev/null || true

  printf '\n===== آخرین پشتیبان =====\n'
  local last
  if last="$(latest_backup)"; then
    printf '%s  (%s)  %s\n' "${last##*/}" "$(du -h "$last" | cut -f1)" "$(date -r "$last" '+%Y-%m-%d %H:%M')"
    local count
    count="$(find "$BACKUP_DIR" -maxdepth 1 -name 'jamal-*.sql.gz' | wc -l)"
    printf 'تعداد کل پشتیبان‌ها: %s   (پوشه: %s)\n' "$count" "$BACKUP_DIR"
  else
    printf 'هیچ پشتیبانی پیدا نشد! یکی بگیرید:  bash /opt/jamal/deploy/backup.sh manual\n'
  fi
  if [[ -f /var/log/jamal-backup.log ]]; then
    printf 'آخرین خطوط گزارش پشتیبان‌گیری:\n'
    tail -n 3 /var/log/jamal-backup.log || true
  fi

  printf '\n===== فضای دیسک =====\n'
  df -h / || true
  du -sh /var/lib/jamal "$BACKUP_DIR" 2>/dev/null || true

  printf '\n===== حافظه (RAM و swap) =====\n'
  free -h || true

  printf '\n===== مصرف منابع کانتینرها =====\n'
  docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' 2>/dev/null || true
  printf '\n'
  return 0
}

main "$@"; exit $?
