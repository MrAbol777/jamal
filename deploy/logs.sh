#!/usr/bin/env bash
# نمایش لاگ برنامه.
# استفاده:  bash /opt/jamal/deploy/logs.sh [app|db|caddy] [تعداد خط]
# برای دنبال کردن زنده:  bash /opt/jamal/deploy/logs.sh app -f   (خروج با Ctrl+C)
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

main() {
  require_root
  local service="${1:-app}" lines="${2:-200}"
  case "$service" in
    app|db|caddy) ;;
    *) die "سرویس نامعتبر: $service  (یکی از app، db، caddy)" ;;
  esac
  if [[ $lines == -f ]]; then
    compose logs --tail 100 -f "$service"
  else
    [[ $lines =~ ^[0-9]+$ ]] || die "تعداد خط باید عدد باشد."
    compose logs --tail "$lines" "$service"
  fi
}

main "$@"; exit $?
