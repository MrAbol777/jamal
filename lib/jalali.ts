import { format, getYear, getMonth, getDate, newDate, isValid } from "date-fns-jalali";
import { toFaDigits } from "./format";

export const MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

export type J = { y: number; m: number; d: number }; // m: 1..12

export function toJ(date: Date): J {
  return { y: getYear(date), m: getMonth(date) + 1, d: getDate(date) };
}

export function todayJ(): J {
  return toJ(new Date());
}

/** ظهر UTC همان روز میلادی، تا جابجایی منطقه زمانی تاریخ را عوض نکند */
export function fromJ(j: J): Date | null {
  const local = newDate(j.y, j.m - 1, j.d);
  if (!isValid(local) || getYear(local) !== j.y || getMonth(local) !== j.m - 1 || getDate(local) !== j.d) return null;
  return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate(), 12));
}

export function daysInMonth(y: number, m: number): number {
  if (m <= 6) return 31;
  if (m <= 11) return 30;
  for (const d of [30, 29]) if (fromJ({ y, m: 12, d })) return d;
  return 29;
}

export function fmtJ(date: Date): string {
  const j = toJ(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return toFaDigits(`${j.y}/${String(j.m).padStart(2, "0")}/${String(j.d).padStart(2, "0")}`);
}

export function jYearOf(date: Date): number {
  return toJ(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).y;
}

export { format };

/** تاریخ ذخیره‌شده (ظهر UTC) → تاریخ شمسی */
export function dateToJ(date: Date): J {
  return toJ(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** تاریخ و ساعت به وقت ایران (Asia/Tehran)، مستقل از منطقه‌ی زمانی سرور */
export function tehranParts(date: Date): { j: J; hh: string; mm: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  const j = toJ(new Date(Number(p.year), Number(p.month) - 1, Number(p.day)));
  return { j, hh: p.hour, mm: p.minute };
}

/** «۱۴۰۵/۰۸/۱۵ ساعت ۱۴:۳۲» به وقت ایران */
export function fmtJTime(date: Date): string {
  const { j, hh, mm } = tehranParts(date);
  const d = `${j.y}/${String(j.m).padStart(2, "0")}/${String(j.d).padStart(2, "0")}`;
  return toFaDigits(`${d} ساعت ${hh}:${mm}`);
}

/** نام فایل پشتیبان: backup-1405-08-15_14-32.json (تاریخ شمسی و ساعت ایران، ارقام لاتین برای سازگاری با همه سیستم‌ها) */
export function backupFileName(date: Date): string {
  const { j, hh, mm } = tehranParts(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `backup-${j.y}-${pad(j.m)}-${pad(j.d)}_${hh}-${mm}.json`;
}
