// تبدیل عدد صحیح به حروف فارسی
const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه", "ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "یکصد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALES = ["", "هزار", "میلیون", "میلیارد", "هزار میلیارد", "میلیون میلیارد"];

function below1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (r) {
    if (r < 20) parts.push(ONES[r]);
    else parts.push(TENS[Math.floor(r / 10)] + (r % 10 ? " و " + ONES[r % 10] : ""));
  }
  return parts.join(" و ");
}

export function numberToWords(input: number): string {
  let n = Math.round(Math.abs(input));
  if (n === 0) return "صفر";
  if (n > Number.MAX_SAFE_INTEGER) return "";
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    // «یک هزار» را به‌صورت «هزار» می‌نویسیم
    const w = i === 1 && g === 1 ? "" : below1000(g);
    parts.push([w, SCALES[i]].filter(Boolean).join(" "));
  }
  return (input < 0 ? "منفی " : "") + parts.join(" و ");
}
