"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconDownload } from "./icons";

/** کلید ذخیره‌ی زمان آخرین نمایش پیام روی همین دستگاه (صفحه‌ی ورود هم آن را پاک می‌کند) */
export const BACKUP_MODAL_KEY = "backup-modal-at";
const HOUR = 60 * 60 * 1000;

const TONE: Record<string, string> = {
  ok: "alert alert-ok",
  warn: "alert alert-warn",
  alert: "alert alert-error",
};

/**
 * پنجره‌ی یادآوری بکاپ: بعد از هر ورود و سپس حداکثر هر ۱ ساعت یک بار روی هر دستگاه نمایش داده می‌شود.
 * (برنامه فقط برای کارکنان خود شرکت است و این پیام از از بین رفتن اطلاعات جلوگیری می‌کند.)
 */
export function BackupModal({ statusText, level }: { statusText: string; level: "ok" | "warn" | "alert" }) {
  const [open, setOpen] = useState(false);
  const lastShown = useRef(0);
  const primary = useRef<HTMLAnchorElement>(null);

  const close = useCallback(() => {
    lastShown.current = Date.now();
    try {
      localStorage.setItem(BACKUP_MODAL_KEY, String(lastShown.current));
    } catch {
      /* حافظه‌ی مرورگر در دسترس نیست؛ فقط در همین صفحه یادآوری می‌شود */
    }
    setOpen(false);
  }, []);

  useEffect(() => {
    const check = () => {
      let stored = 0;
      try {
        stored = Number(localStorage.getItem(BACKUP_MODAL_KEY) || 0);
      } catch {
        /* ignore */
      }
      const last = Math.max(stored, lastShown.current);
      if (!last || Date.now() - last >= HOUR) setOpen(true);
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-labelledby="backup-modal-title" className="card w-full max-w-md space-y-4 !p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-12 h-12 rounded-2xl bg-brand-soft text-brand shrink-0">
            <IconDownload size={26} />
          </span>
          <h2 id="backup-modal-title" className="text-lg font-bold leading-snug">
            یادآوری مهم: نسخه‌ی پشتیبان
          </h2>
        </div>
        <p className="leading-8">
          وقتی کارت تموم شد، برو به <b>تنظیمات ← دانلود نسخه پشتیبان</b> و فایل رو ذخیره کن تا اگه اتفاقی برای سیستم افتاد، اطلاعات صورتحساب‌ها از بین نره.
        </p>
        <p className={TONE[level]} role="status">
          {statusText}
        </p>
        <div className="grid gap-2">
          <a ref={primary} href="/settings/backup" download onClick={close} className="btn btn-primary w-full">
            <IconDownload size={20} />
            دانلود نسخه پشتیبان همین الان
          </a>
          <button type="button" className="btn btn-ghost w-full" onClick={close}>
            متوجه شدم
          </button>
        </div>
        <p className="help text-center !mt-0">این پیام بعد از هر ورود و سپس هر یک ساعت یک بار نمایش داده می‌شود.</p>
      </div>
    </div>
  );
}
