#!/usr/bin/env bash
# به‌روزرسانی برنامه به آخرین نسخه‌ی GitHub.
# استفاده:
#   bash /opt/jamal/deploy/update.sh                 به‌روزرسانی (قبلش پشتیبان می‌گیرد)
#   bash /opt/jamal/deploy/update.sh --force         ساخت دوباره حتی اگر نسخه‌ی جدیدی نباشد
#   bash /opt/jamal/deploy/update.sh --rollback      برگشت به نسخه‌ی قبل از آخرین به‌روزرسانی
#   bash /opt/jamal/deploy/update.sh --rollback <commit>
# اگر نسخه‌ی جدید سالم بالا نیاید، خودکار به نسخه‌ی قبلی برمی‌گردد.
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

GIT_BRANCH="${GIT_BRANCH:-main}"
PREV_FILE="$STATE_DIR/previous-commit"
export GIT_TERMINAL_PROMPT=0

git_app() { git -C "$JAMAL_APP_DIR" "$@"; }

deploy_current() {
  info "ساخت ایمیج برنامه (ممکن است ۵ تا ۱۵ دقیقه طول بکشد)..."
  compose build app || return 1
  info "راه‌اندازی دوباره..."
  compose up -d || return 1
  info "منتظر سالم شدن برنامه..."
  wait_for_app 600
}

ensure_clean_tree() {
  local changes
  changes="$(git_app status --porcelain --untracked-files=no)"
  if [[ -n $changes ]]; then
    printf '%s\n' "$changes" >&2
    die "فایل‌های برنامه روی سرور دستی تغییر کرده‌اند. این تغییرات را برگردانید (git -C $JAMAL_APP_DIR checkout -- .) و دوباره امتحان کنید."
  fi
}

rollback_to() {
  local target=$1
  git_app cat-file -e "$target^{commit}" 2>/dev/null || die "نسخه‌ی $target در مخزن پیدا نشد."
  info "برگشت به نسخه‌ی $target ..."
  git_app reset -q --hard "$target"
  if deploy_current; then
    ok "برنامه به نسخه‌ی $(git_app rev-parse --short HEAD) برگشت و سالم است."
    return 0
  fi
  return 1
}

do_rollback() {
  local target="${1:-}"
  if [[ -z $target ]]; then
    [[ -f $PREV_FILE ]] || die "نسخه‌ی قبلی ثبت نشده است. شناسه‌ی commit را بدهید:  update.sh --rollback <commit>"
    target="$(<"$PREV_FILE")"
  fi
  ensure_clean_tree
  info "گرفتن پشتیبان قبل از برگشت..."
  bash "$JAMAL_DEPLOY_DIR/backup.sh" pre-rollback || die "پشتیبان گرفته نشد؛ برگشت انجام نشد."
  rollback_to "$target" || die "برگشت ناموفق بود. لاگ:  bash /opt/jamal/deploy/logs.sh app"
  printf 'اگر داده‌ها هم باید به قبل برگردد، از پشتیبان pre-update با restore.sh استفاده کنید.\n'
}

main() {
  require_root
  acquire_lock 0 || die "عملیات دیگری (پشتیبان‌گیری/بازگردانی/به‌روزرسانی) در حال اجراست. چند دقیقه بعد دوباره امتحان کنید."
  mkdir -p "$STATE_DIR"

  local force=0
  case "${1:-}" in
    --rollback) do_rollback "${2:-}"; return 0 ;;
    --force) force=1 ;;
    "") ;;
    *) die "گزینه‌ی نامعتبر: $1" ;;
  esac

  [[ -d $JAMAL_APP_DIR/.git ]] || die "$JAMAL_APP_DIR مخزن git نیست."
  ensure_clean_tree

  local prev new
  prev="$(git_app rev-parse HEAD)"

  info "دریافت آخرین نسخه از GitHub..."
  retry 4 15 timeout 300 git -C "$JAMAL_APP_DIR" -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=60 \
    fetch -q origin "$GIT_BRANCH" || die "دریافت از GitHub ممکن نشد. اتصال اینترنت سرور را بررسی کنید."
  new="$(git_app rev-parse "origin/$GIT_BRANCH")"

  if [[ $prev == "$new" && $force -eq 0 ]]; then
    ok "برنامه به‌روز است (نسخه‌ی $(git_app rev-parse --short HEAD)). کاری انجام نشد."
    return 0
  fi

  info "گرفتن پشتیبان قبل از به‌روزرسانی..."
  bash "$JAMAL_DEPLOY_DIR/backup.sh" pre-update || die "پشتیبان گرفته نشد؛ برای حفظ داده‌ها به‌روزرسانی انجام نشد."
  local pre_backup
  pre_backup="$(latest_backup pre-update || true)"

  printf '%s\n' "$prev" >"$PREV_FILE"
  if [[ $prev != "$new" ]]; then
    git_app merge -q --ff-only "origin/$GIT_BRANCH" \
      || die "به‌روزرسانی git ممکن نشد (تاریخچه‌ی ناسازگار). کمک فنی بگیرید."
  fi

  if deploy_current; then
    ok "به‌روزرسانی انجام شد: $(git_app rev-parse --short "$prev") -> $(git_app rev-parse --short HEAD)"
    printf '\nاگر نسخه‌ی جدید مشکلی داشت، برای برگشت به نسخه‌ی قبلی:\n'
    printf '  bash /opt/jamal/deploy/update.sh --rollback\n'
    if [[ -n $pre_backup ]]; then
      printf 'پشتیبان قبل از به‌روزرسانی: %s\n' "$pre_backup"
    fi
    return 0
  fi

  warn "نسخه‌ی جدید سالم بالا نیامد. برگشت خودکار به نسخه‌ی قبلی..."
  compose logs --tail 60 app >&2 || true
  if [[ $prev != "$(git_app rev-parse HEAD)" ]] && rollback_to "$prev"; then
    warn "برنامه به نسخه‌ی قبلی برگشت و کار می‌کند، اما به‌روزرسانی انجام نشد."
    warn "اگر داده‌ها مشکل داشت:  bash /opt/jamal/deploy/restore.sh ${pre_backup:-<فایل pre-update>}"
    exit 1
  fi
  die "برنامه بالا نیامد. لاگ:  bash /opt/jamal/deploy/logs.sh app   پشتیبان: ${pre_backup:-نامشخص}"
}

main "$@"; exit $?
