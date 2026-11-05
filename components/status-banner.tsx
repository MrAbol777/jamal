import Link from "next/link";
import type { Level, SystemStatus } from "@/lib/status";

const TONE: Record<Exclude<Level, "ok">, string> = { warn: "alert alert-warn", alert: "alert alert-error" };

/** نوار هشدارهای بالای صفحه: بکاپ، دیتابیس و سقف‌های پلن رایگان (فقط وقتی لازم است نمایش داده می‌شود) */
export function StatusBanner({ status }: { status: SystemStatus }) {
  const items: { level: Exclude<Level, "ok">; text: string; action?: { href: string; label: string; download?: boolean } }[] = [];

  if (!status.dbOk) {
    items.push({ level: "alert", text: "اتصال به دیتابیس برقرار نیست. اطلاعات پاک نشده؛ چند لحظه بعد صفحه را دوباره باز کنید." });
  }
  const b = status.backup;
  if (b.level !== "ok") {
    items.push({
      level: b.level,
      text: !b.at
        ? `${b.text}! همین الان یک نسخه دانلود کنید.`
        : b.level === "alert"
          ? `${b.text}! همین الان یک نسخه‌ی جدید دانلود کنید.`
          : `${b.text}. بهتر است نسخه‌ی جدیدی دانلود کنید و فایل را در دو جا نگه دارید.`,
      action: { href: "/settings/backup", label: "دانلود نسخه پشتیبان", download: true },
    });
  }
  const k = status.platform.keepalive;
  if (k && k.level !== "ok") items.push({ level: k.level, text: k.text, action: { href: "/settings#status", label: "جزئیات" } });
  const s = status.platform.dbSize;
  if (s && s.level !== "ok") items.push({ level: s.level, text: `${s.text}؛ نزدیک سقف پلن رایگان است.`, action: { href: "/settings#status", label: "جزئیات" } });

  if (items.length === 0) return null;
  return (
    <div className="space-y-2 mb-4" aria-label="هشدارهای سیستم">
      {items.map((it, i) => (
        <div key={i} className={`${TONE[it.level]} !items-center flex-wrap`} role={it.level === "alert" ? "alert" : "status"}>
          <span className="flex-1 min-w-[12rem]">{it.text}</span>
          {it.action &&
            (it.action.download ? (
              <a href={it.action.href} download className="font-bold underline underline-offset-4 whitespace-nowrap">
                {it.action.label}
              </a>
            ) : (
              <Link href={it.action.href} className="font-bold underline underline-offset-4 whitespace-nowrap">
                {it.action.label}
              </Link>
            ))}
        </div>
      ))}
    </div>
  );
}
