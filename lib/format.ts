const FA = "۰۱۲۳۴۵۶۷۸۹";

export function toFaDigits(s: string | number): string {
  return String(s).replace(/\d/g, (d) => FA[+d]);
}

/** تبدیل ارقام فارسی/عربی به انگلیسی و حذف جداکننده‌ها */
export function toEnDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[,٬،\s]/g, "")
    .replace(/٫/g, ".");
}

export function parseNum(s: string | null | undefined): number {
  if (!s) return 0;
  const n = Number(toEnDigits(String(s)));
  return Number.isFinite(n) ? n : 0;
}

/** عدد با جداکننده هزارگان و ارقام فارسی */
export function fmtNum(n: number, maxFraction = 0): string {
  const v = maxFraction ? Math.round(n * 10 ** maxFraction) / 10 ** maxFraction : Math.round(n);
  const [i, f] = v.toString().split(".");
  const withSep = i.replace(/\B(?=(\d{3})+(?!\d))/g, "٬");
  return toFaDigits(f ? `${withSep}.${f}`.replace(".", "٫") : withSep);
}

/** شماره فاکتور: سال شمسی + ۴ رقم ترتیبی، مثلاً ۱۴۰۵۰۰۰۱ */
export const fmtInvoiceNo = (year: number, number: number) => toFaDigits(`${year}${String(number).padStart(4, "0")}`);

export const fmtRial = (n: number) => fmtNum(n);
export const fmtWeight = (n: number) => fmtNum(n, 3);

/** مبلغ ردیف = وزن × فی، گرد شده به ریال */
export const lineTotal = (weight: number, fee: number) => Math.round(weight * fee);

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** جداکننده هزارگان با ارقام لاتین (برای ورودی‌ها) */
export const groupDigits = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
/** فقط ارقام (ورودی عدد صحیح) */
export const cleanInt = (s: string) => toEnDigits(s).replace(/\D/g, "");
/** ارقام و یک ممیز (ورودی اعشاری) */
export const cleanDec = (s: string) => {
  const t = toEnDigits(s).replace(/[^\d.]/g, "");
  const [a, ...b] = t.split(".");
  return b.length ? `${a}.${b.join("")}` : a;
};
