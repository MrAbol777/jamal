import { db } from "./db";
import { toFaDigits } from "./format";
import { fmtJTime } from "./jalali";

/** آستانه‌های هشدار بکاپ (روز) */
export const BACKUP_WARN_DAYS = 7;
export const BACKUP_ALERT_DAYS = 14;
/** پلن رایگان سوپابیس بعد از این‌قدر روز بی‌فعالیتی پروژه را متوقف می‌کند */
export const SUPABASE_PAUSE_DAYS = 7;
/** سقف حجم دیتابیس در پلن رایگان سوپابیس */
export const SUPABASE_DB_LIMIT_BYTES = 500 * 1024 * 1024;

export type Level = "ok" | "warn" | "alert";

export type SystemStatus = {
  dbOk: boolean;
  backup: { at: Date | null; days: number | null; level: Level; text: string };
  platform: {
    isNetlify: boolean;
    isSupabase: boolean;
    keepalive: { at: Date | null; days: number | null; daysLeft: number | null; level: Level; text: string } | null;
    dbSize: { bytes: number; pct: number; level: Level; text: string } | null;
  };
};

const DAY = 24 * 60 * 60 * 1000;
const daysSince = (d: Date, now: number) => Math.max(0, Math.floor((now - d.getTime()) / DAY));
const fa = toFaDigits;

export function agoText(days: number): string {
  if (days <= 0) return "امروز";
  if (days === 1) return "دیروز";
  return `${fa(days)} روز پیش`;
}

export function backupLevel(days: number | null): Level {
  if (days === null || days >= BACKUP_ALERT_DAYS) return "alert";
  if (days >= BACKUP_WARN_DAYS) return "warn";
  return "ok";
}

export function backupText(at: Date | null, days: number | null): string {
  if (!at || days === null) return "هنوز نسخه‌ی پشتیبانی دانلود نشده است";
  return `آخرین نسخه‌ی پشتیبان ${agoText(days)} (${fmtJTime(at)}) دانلود شده است`;
}

/** وضعیت سیستم برای نوارها و کارت وضعیت؛ اگر دیتابیس در دسترس نباشد dbOk=false برمی‌گردد */
export async function getSystemStatus(now = Date.now()): Promise<SystemStatus> {
  const isNetlify = process.env.NETLIFY === "true";
  const isSupabase = /supabase\./i.test(process.env.DATABASE_URL ?? "");

  let setting: { lastBackupAt: Date | null; lastKeepaliveAt: Date | null } | null = null;
  let dbOk = true;
  try {
    setting = await db.setting.findUnique({ where: { id: 1 }, select: { lastBackupAt: true, lastKeepaliveAt: true } });
  } catch {
    dbOk = false;
  }

  const backupAt = setting?.lastBackupAt ?? null;
  const backupDays = backupAt ? daysSince(backupAt, now) : null;
  const backup = { at: backupAt, days: backupDays, level: backupLevel(backupDays), text: backupText(backupAt, backupDays) };

  let keepalive: SystemStatus["platform"]["keepalive"] = null;
  let dbSize: SystemStatus["platform"]["dbSize"] = null;

  if (isSupabase && dbOk) {
    const at = setting?.lastKeepaliveAt ?? null;
    const days = at ? daysSince(at, now) : null;
    const daysLeft = days === null ? null : Math.max(0, SUPABASE_PAUSE_DAYS - days);
    let level: Level = "ok";
    let text: string;
    if (days === null) {
      level = "warn";
      text = "هنوز اجرای نگه‌دارنده‌ی خودکار دیتابیس ثبت نشده است (بعد از دیپلوی تا ۲۴ ساعت طول می‌کشد)";
    } else if (days >= 5) {
      level = "alert";
      text = `نگه‌دارنده‌ی خودکار ${agoText(days)} اجرا شده! اگر تا ${fa(daysLeft ?? 0)} روز دیگر هیچ استفاده‌ای نشود، دیتابیس رایگان متوقف می‌شود`;
    } else if (days >= 2) {
      level = "warn";
      text = `نگه‌دارنده‌ی خودکار ${agoText(days)} اجرا شده؛ دیتابیس تا ${fa(daysLeft ?? 0)} روز دیگر بی‌خطر است`;
    } else {
      text = `نگه‌دارنده‌ی خودکار ${agoText(days)} اجرا شد؛ دیتابیس رایگان تا ${fa(daysLeft ?? 0)} روز دیگر بی‌خطر است`;
    }
    keepalive = { at, days, daysLeft, level, text };

    try {
      const rows = await db.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) AS size`;
      const bytes = Number(rows[0]?.size ?? 0);
      const pct = Math.min(100, Math.round((bytes / SUPABASE_DB_LIMIT_BYTES) * 1000) / 10);
      const mb = (n: number) => fa((Math.round((n / 1024 / 1024) * 10) / 10).toString().replace(".", "٫"));
      dbSize = {
        bytes,
        pct,
        level: pct >= 90 ? "alert" : pct >= 80 ? "warn" : "ok",
        text: `حجم دیتابیس ${mb(bytes)} مگابایت از ${fa(500)} مگابایت (${fa(pct.toString().replace(".", "٫"))}٪)`,
      };
    } catch {
      dbSize = null;
    }
  }

  return { dbOk, backup, platform: { isNetlify, isSupabase, keepalive, dbSize } };
}
