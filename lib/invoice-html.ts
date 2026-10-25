import fs from "node:fs";
import path from "node:path";
import { escapeHtml as e, fmtInvoiceNo, fmtRial, fmtWeight, toFaDigits } from "./format";
import { fmtJ } from "./jalali";
import { calcTotals, type FullInvoice } from "./invoice";

/** ردیف تنظیمات شرکت؛ هر رشته‌ای می‌تواند خالی باشد (در چاپ پنهان می‌شود) */
export type InvoiceCompany = {
  companyName: string;
  subtitle: string;
  address: string;
  phone: string;
  mobile: string;
  managerName: string;
  footerNote: string;
  logo: string | null;
};

let fontCss: string | null = null;
function fonts(): string {
  if (fontCss) return fontCss;
  const dir = path.join(process.cwd(), "public", "fonts");
  const face = (file: string, weight: number) =>
    `@font-face{font-family:Vazirmatn;font-weight:${weight};src:url(data:font/woff2;base64,${fs
      .readFileSync(path.join(dir, file))
      .toString("base64")}) format("woff2")}`;
  fontCss = face("Vazirmatn-Regular.woff2", 400) + face("Vazirmatn-Bold.woff2", 700);
  return fontCss;
}

export type PaperSize = "a4" | "a5";

/** تعداد ردیف‌های خالی بعد از آخرین ردیف (مثل نمونه‌های کاغذی) */
const SPARE_ROWS = 3;

const s = (v: string | null | undefined) => (v ?? "").trim();

export function invoiceHtml(inv: FullInvoice, co: InvoiceCompany, size: PaperSize = "a4"): string {
  const t = calcTotals(inv.items, inv.expenseAmount);
  const num = (v: string) => `<span class="n">${v}</span>`;
  // ممیز اعشار مثل نمونه‌های کاغذی نقطه است («٫» در این فونت شبیه «/» تاریخ دیده می‌شود)
  const weight = (w: number) => fmtWeight(w).replace("٫", ".");

  const rows = inv.items
    .map(
      (it, i) => `<tr>
<td>${toFaDigits(i + 1)}</td>
<td class="n">${fmtJ(it.date)}</td>
<td class="t">${e(toFaDigits(s(it.havaleNo)))}</td>
<td class="t b">${e(toFaDigits(s(it.productName)))}</td>
<td class="n b">${it.weight == null ? "" : weight(it.weight)}</td>
<td class="n b">${it.fee == null ? "" : fmtRial(it.fee)}</td>
<td class="n b">${fmtRial(it.amount)}</td>
</tr>`,
    )
    .join("");
  const spare = Array.from(
    { length: SPARE_ROWS },
    (_, k) => `<tr class="spare"><td>${toFaDigits(inv.items.length + k + 1)}</td><td></td><td></td><td></td><td></td><td></td><td>–</td></tr>`,
  ).join("");

  const money = (n: number) => (n ? num(fmtRial(n)) : "–");
  const companyName = s(co.companyName);
  const subtitle = s(co.subtitle);
  const address = s(co.address);
  const phone = s(co.phone);
  const mobile = s(co.mobile);
  const manager = s(co.managerName);
  const footer = s(co.footerNote);
  const invNo = fmtInvoiceNo(inv.year, inv.number);
  const customer = s(inv.customer.name);

  /* عرض ستون‌ها از راست به چپ: ردیف | تاریخ | حواله | نوع چله | وزن | فی | قیمت کل */
  const cols = `<colgroup><col class="w-r"><col class="w-d"><col class="w-h"><col class="w-p"><col class="w-w"><col class="w-f"><col class="w-a"></colgroup>`;

  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>صورتحساب ${e(customer)} - ${invNo}</title>
<style>
${fonts()}
/* حاشیه صفحه از خود قالب (pdf.ts حاشیه را صفر می‌گذارد)؛ با @page در همه صفحات تکرار می‌شود */
@page{size:${size === "a5" ? "A5" : "A4"};margin:${size === "a5" ? "7mm 7mm 7mm" : "12mm 13mm 12mm"}}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
body{font-family:Vazirmatn,sans-serif;color:#000;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body.a4{font-size:10pt}
body.a5{font-size:7.8pt}
.page{width:100%}
.n{direction:ltr;unicode-bidi:isolate;white-space:nowrap;font-variant-numeric:tabular-nums}
.b{font-weight:700}

/* ---------- سربرگ ---------- */
.hd{position:relative;text-align:center}
.hd.has-logo{padding:0 6.5em;min-height:5.4em}
.hd h1{margin:0;font-size:1.9em;line-height:1.35;font-weight:700}
.hd .sub{margin:.1em 0 0;font-size:.86em;font-weight:700}
.logo{position:absolute;top:0;left:0;width:5.2em;height:5.2em;object-fit:contain}
.meta{display:flex;justify-content:space-between;align-items:flex-start;gap:2em;margin-top:1em;font-size:.88em}
.meta>div{min-width:0}
.meta .l{flex:none;text-align:right}
.meta p{margin:0}
.meta .k{font-weight:700}
.doc{display:flex;justify-content:space-between;gap:2em;margin-top:.7em;font-size:.92em}
.doc .k{font-weight:400}
.doc b{font-weight:700}
.title{margin:.55em 0 .45em;text-align:center;font-weight:700;font-size:1.22em;overflow-wrap:anywhere}

/* ---------- جدول ---------- */
table.grid{width:100%;border-collapse:collapse;table-layout:fixed;border:1pt solid #000}
.grid col.w-r{width:6%}.grid col.w-d{width:13.5%}.grid col.w-h{width:12%}.grid col.w-p{width:20.5%}
.grid col.w-w{width:13%}.grid col.w-f{width:14%}.grid col.w-a{width:21%}
.grid thead{display:table-header-group}
.grid tr{break-inside:avoid;page-break-inside:avoid}
.grid th,.grid td{border:.75pt solid #000;text-align:center;vertical-align:middle;padding:.17em .3em;line-height:1.38}
.grid th{font-weight:700;font-size:1.02em;padding:.28em .2em;white-space:nowrap;background:#fff}
.grid td.t{overflow-wrap:anywhere}
.grid tr.spare td{height:1.75em}
/* سه ردیف جمع: جدول جدا با همان عرض تا همراه امضاها یکجا (بدون شکستن) چاپ شود */
.end{break-inside:avoid;page-break-inside:avoid}
/* حاشیه منفی: کادر بالای جدول جمع روی کادر پایین جدول اقلام می‌افتد؛ اگر به صفحه بعد برود کادرش کامل است */
table.sum{margin-top:-1pt}
.sum td{background:#d9d9d9;font-weight:700;padding:.26em .3em;font-size:1.05em}
.sum td.v{width:21%}

/* ---------- امضا و پانویس ---------- */
.sign{display:flex;justify-content:space-between;align-items:flex-start;margin-top:1.4em;padding:0 3%;font-size:.92em}
.sign>div{width:30%;text-align:center}
.sign .mgr{border-top:.75pt solid #000;padding-top:.3em}
.sign .who{margin-top:.15em;font-weight:700}
.sign .space{height:1.6em}
.sign .cst{padding-top:.3em;border-top:.75pt solid transparent}
footer{margin-top:1.2em;text-align:center;font-size:.8em;color:#222;white-space:pre-line}

/* ---------- نمایش روی صفحه (پیش‌نمایش) ---------- */
@media screen{
  html{background:#fff}
  body.a4,body.a5{font-size:13px}
  .page{max-width:820px;margin:0 auto;padding:28px 24px 36px}
}
@media screen and (max-width:640px){
  body.a4,body.a5{font-size:11px}
  .page{padding:14px 8px 24px}
  .hd.has-logo{padding:0 4.6em;min-height:4.2em}
  .hd h1{font-size:1.6em}
  .logo{width:4em;height:4em}
  .meta{flex-direction:column;gap:.25em;margin-top:.8em}
  .meta .l{text-align:right}
  .doc{gap:.6em;flex-wrap:wrap}
  .grid th,.grid td{padding:.3em .12em;font-size:8.6px;line-height:1.3}
  .grid th{font-size:8.6px;white-space:normal}
  .grid col.w-r{width:5.5%}.grid col.w-d{width:17%}.grid col.w-h{width:11%}.grid col.w-p{width:16%}
  .grid col.w-w{width:12%}.grid col.w-f{width:16%}.grid col.w-a{width:22.5%}
  .sum td{font-size:9.5px}
  .sum td.v{width:22.5%}
  .sign{padding:0}
  .sign>div{width:42%}
}
</style></head><body class="${size}"><div class="page">
<header class="hd${co.logo ? " has-logo" : ""}">
  ${co.logo ? `<img class="logo" src="${e(co.logo)}" alt="">` : ""}
  ${companyName ? `<h1>${e(companyName)}</h1>` : ""}
  ${subtitle ? `<p class="sub">${e(subtitle)}</p>` : ""}
</header>
${
  address || phone || mobile
    ? `<div class="meta">
  <div>${address ? `<p><span class="k">آدرس:</span> ${e(toFaDigits(address))}</p>` : ""}</div>
  <div class="l">
    ${phone ? `<p><span class="k">تلفن:</span> ${num(e(toFaDigits(phone)))}</p>` : ""}
    ${mobile ? `<p><span class="k">شماره موبایل:</span> ${num(e(toFaDigits(mobile)))}</p>` : ""}
  </div>
</div>`
    : ""
}
<div class="doc">
  <div><span class="k">تاریخ فاکتور:</span> <b>${num(fmtJ(inv.date))}</b></div>
  <div><span class="k">شماره فاکتور:</span> <b>${num(invNo)}</b></div>
</div>
<div class="title">صورتحساب ${e(customer)}</div>

<table class="grid items">
  ${cols}
  <thead><tr><th>ردیف</th><th>تاریخ فروش</th><th>شماره حواله</th><th>نوع چله</th><th>وزن (کیلوگرم)</th><th>فی</th><th>قیمت کل</th></tr></thead>
  <tbody>${rows}${spare}</tbody>
</table>
<div class="end">
  <table class="grid sum">
    <tr><td>جمع کل صورتحساب</td><td class="v">${money(t.subtotal)}</td></tr>
    <tr><td>${e(s(inv.expenseTitle) || "هزینه")}</td><td class="v">${money(t.expense)}</td></tr>
    <tr><td>مانده حساب</td><td class="v">${money(t.balance)}</td></tr>
  </table>
  <div class="sign">
    <div><div class="space"></div><div class="cst">امضا مشتری</div></div>
    <div><div class="space"></div><div class="mgr">امضا مدیریت</div>${manager ? `<div class="who">${e(manager)}</div>` : ""}</div>
  </div>
  ${footer ? `<footer>${e(footer)}</footer>` : ""}
</div>
</div></body></html>`;
}
