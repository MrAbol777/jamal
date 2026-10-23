import fs from "node:fs";
import path from "node:path";
import { escapeHtml as e, fmtInvoiceNo, fmtRial, fmtWeight, lineTotal, toFaDigits } from "./format";
import { numberToWords } from "./words";
import { fmtJ } from "./jalali";
import { calcTotals, type FullInvoice } from "./invoice";

type Company = { companyName: string; address: string; phone: string; footerNote: string; logo: string | null };

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

/** لوگوی پیش‌فرض: نشان تک‌رنگ مشکی (گلوله نخ) که در چاپ سیاه‌وسفید هم تمیز است */
const DEFAULT_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#000" stroke-linecap="round"><circle cx="32" cy="32" r="29" stroke-width="2.5"/><circle cx="32" cy="32" r="19" stroke-width="2.5"/><path d="M17.5 22c7 1.5 17 8 22 25.5M14 31c7 0 15.5 4 20 19.5M23 14.5c6.5 3 15.5 10.5 19.5 22.5M33 13.5c4.5 3 9.5 8.5 11.5 16" stroke-width="2"/></svg>`,
)}`;

export type PaperSize = "a4" | "a5";

export function invoiceHtml(inv: FullInvoice, co: Company, size: PaperSize = "a4"): string {
  const t = calcTotals(inv.items, inv.expenseAmount);
  const rows = inv.items
    .map(
      (it, i) => `<tr>
        <td class="c">${toFaDigits(i + 1)}</td>
        <td class="name">${e(it.productName)}</td>
        <td>${e(toFaDigits(it.cheleName)) || "—"}</td>
        <td class="n">${fmtWeight(it.weight)}</td>
        <td class="n">${fmtRial(it.fee)}</td>
        <td class="n b">${fmtRial(lineTotal(it.weight, it.fee))}</td>
      </tr>`,
    )
    .join("");
  const totalWeight = inv.items.reduce((s, i) => s + i.weight, 0);
  const dash = `<span class="muted">—</span>`;

  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>فاکتور ${fmtInvoiceNo(inv.year, inv.number)}</title>
<style>
${fonts()}
/* حاشیه صفحه از خود قالب (pdf.ts حاشیه را صفر می‌گذارد)؛ با @page در همه صفحات تکرار می‌شود */
@page{size:${size === "a5" ? "A5" : "A4"};margin:${size === "a5" ? "9mm 9mm 10mm" : "13mm 13mm 14mm"}}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
body{font-family:Vazirmatn,sans-serif;color:#000;line-height:1.6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body.a4{font-size:9.6pt}
body.a5{font-size:7.9pt}
.page{width:100%}
.muted{color:#777}
.n{direction:ltr;text-align:left;white-space:nowrap;font-variant-numeric:tabular-nums}
.c{text-align:center}
.b{font-weight:700}

/* ---------- سربرگ ---------- */
.hd{display:flex;align-items:stretch;justify-content:space-between;gap:1.6em}
.brand{display:flex;align-items:center;gap:1.1em;min-width:0;flex:1}
.brand img{width:5.6em;height:5.6em;object-fit:contain;flex:none}
.brand h1{margin:0;font-size:1.75em;line-height:1.3;font-weight:700;letter-spacing:-.01em}
.brand p{margin:.15em 0 0;font-size:.92em;color:#333}
.brand p span{white-space:nowrap}
.doc{flex:none;width:17.5em;display:flex;flex-direction:column}
.doc-title{background:#000;color:#fff;text-align:center;font-weight:700;font-size:1.3em;padding:.3em .6em;letter-spacing:.02em}
.kv{width:100%;border-collapse:collapse;border:1px solid #000;border-top:0;font-size:.95em}
.kv th,.kv td{padding:.28em .7em;border-top:.5pt solid #bbb}
.kv tr:first-child th,.kv tr:first-child td{border-top:0}
.kv th{font-weight:400;color:#444;text-align:right;white-space:nowrap;width:1%}
.kv td{font-weight:700;text-align:left;direction:ltr}
.rule{margin:1.1em 0 1.2em;border-top:2pt solid #000;border-bottom:.6pt solid #000;height:3pt}

/* ---------- خریدار ---------- */
.sec-h{font-weight:700;font-size:.92em;margin:0 0 .45em;display:flex;align-items:center;gap:.6em}
.sec-h::after{content:"";flex:1;border-top:.6pt solid #000}
.party{display:grid;grid-template-columns:1.35fr 1fr;border:1px solid #000;margin-bottom:1.3em}
.f{display:flex;gap:.8em;padding:.42em .8em;border-top:.5pt solid #bbb;min-width:0}
.f:nth-child(-n+2){border-top:0}
.f:nth-child(odd){border-left:.5pt solid #bbb}
.f .k{color:#444;white-space:nowrap;flex:none}
.f .v{font-weight:700;min-width:0;overflow-wrap:anywhere}
.f.wide{grid-column:1/-1;border-left:0}

/* ---------- جدول اقلام ---------- */
.items{width:100%;border-collapse:collapse;border:1px solid #000}
.items thead{display:table-header-group}
.items tfoot{display:table-row-group}
.items th{background:#000;color:#fff;font-weight:700;font-size:.9em;padding:.55em .6em;text-align:right;line-height:1.35;vertical-align:middle;border-left:.5pt solid #555}
.items th:last-child{border-left:0}
.items th small{display:block;font-weight:400;font-size:.82em;opacity:.8}
.items th.n{text-align:left}
.items td{padding:.5em .6em;border-top:.5pt solid #b5b5b5;border-left:.5pt solid #d6d6d6;vertical-align:top}
.items td:last-child{border-left:0}
.items tbody tr:nth-child(even) td{background:#f4f4f4}
.items tr{break-inside:avoid;page-break-inside:avoid}
.items td.c{width:2.6em;color:#333}
.items td.name{font-weight:700}
.items tfoot td{border-top:1.2pt solid #000;background:#fff;font-weight:700;padding:.45em .6em}
.items tfoot td.lbl{text-align:right;color:#333;font-weight:400}

/* ---------- جمع و حروف ---------- */
.bottom{display:flex;gap:1.6em;align-items:flex-start;margin-top:1.3em;break-inside:avoid;page-break-inside:avoid}
.side{flex:1;min-width:0}
.words{border:1px solid #000;padding:.6em .85em}
.words .k{display:block;font-size:.85em;color:#444;margin-bottom:.15em}
.words .v{font-weight:700}
.note{margin-top:.8em;padding:.55em .85em;border-right:2.5pt solid #000;background:#f4f4f4;white-space:pre-line}
.note b{margin-left:.3em}
.totals{flex:none;width:23em;border-collapse:collapse;border:1px solid #000}
.totals th,.totals td{padding:.5em .85em;border-top:.5pt solid #bbb}
.totals tr:first-child th,.totals tr:first-child td{border-top:0}
.totals th{text-align:right;font-weight:400;color:#222;white-space:nowrap}
.totals td{text-align:left;white-space:nowrap;direction:rtl}
.totals .grand th,.totals .grand td{background:#000;color:#fff;font-weight:700;font-size:1.12em;border-top:0;padding:.6em .85em}
.cur{font-size:.8em;font-weight:400;margin-right:.25em}

/* ---------- امضا و پانویس ---------- */
.sign{display:grid;grid-template-columns:1fr 1fr;gap:2.5em;margin-top:2.6em;break-inside:avoid;page-break-inside:avoid}
.sign div{text-align:center;font-size:.9em;color:#333;padding-bottom:3.6em;border-bottom:.8pt dotted #000}
footer{margin-top:1.8em;padding-top:.6em;border-top:.6pt solid #000;text-align:center;font-size:.9em;color:#222;white-space:pre-line;break-inside:avoid;page-break-inside:avoid}

/* ---------- نمایش روی صفحه (پیش‌نمایش) ---------- */
@media screen{
  html{background:#fff}
  body.a4,body.a5{font-size:12.5px}
  .page{max-width:794px;margin:0 auto;padding:28px 26px 32px}
}
@media screen and (max-width:560px){
  body.a4,body.a5{font-size:11px}
  .page{padding:14px 12px 22px}
  .hd{flex-direction:column;gap:1em}
  .brand img{width:4.4em;height:4.4em}
  .brand h1{font-size:1.5em}
  .doc{width:100%}
  .party{grid-template-columns:1fr}
  .f,.f:nth-child(-n+2){border-top:.5pt solid #bbb;border-left:0}
  .f:first-child{border-top:0}
  .items th,.items td{padding:.45em .3em}
  .items th small{font-size:.75em}
  .items col{width:auto!important}
  .items td.n{font-size:.92em}
  .items td.c{width:1.8em}
  .bottom{flex-direction:column-reverse;align-items:stretch;gap:1em}
  .totals{width:100%}
  .sign{gap:1.2em}
}
</style></head><body class="${size}"><div class="page">
<header class="hd">
  <div class="brand">
    <img src="${co.logo || DEFAULT_LOGO}" alt="">
    <div>
      <h1>${e(co.companyName)}</h1>
      ${co.address ? `<p>${e(co.address)}</p>` : ""}
      ${co.phone ? `<p><span>تلفن: <span class="n" dir="ltr">${e(toFaDigits(co.phone))}</span></span></p>` : ""}
    </div>
  </div>
  <div class="doc">
    <div class="doc-title">فاکتور فروش</div>
    <table class="kv">
      <tr><th>شماره فاکتور</th><td>${fmtInvoiceNo(inv.year, inv.number)}</td></tr>
      <tr><th>تاریخ</th><td>${fmtJ(inv.date)}</td></tr>
      <tr><th>شماره حواله</th><td>${inv.havaleNo ? e(toFaDigits(inv.havaleNo)) : "—"}</td></tr>
    </table>
  </div>
</header>
<div class="rule"></div>

<div class="sec-h">مشخصات خریدار</div>
<div class="party">
  <div class="f"><span class="k">نام خریدار:</span><span class="v">${e(inv.customer.name)}</span></div>
  <div class="f"><span class="k">نوع پرداخت:</span><span class="v">${e(inv.paymentType)}</span></div>
  <div class="f"><span class="k">تلفن:</span><span class="v">${inv.customer.phone ? `<span class="n" dir="ltr">${e(toFaDigits(inv.customer.phone))}</span>` : dash}</span></div>
  <div class="f"><span class="k">آدرس:</span><span class="v">${inv.customer.address ? e(inv.customer.address) : dash}</span></div>
</div>

<div class="sec-h">شرح اقلام</div>
<table class="items">
  <colgroup><col style="width:3.2em"><col><col style="width:13%"><col style="width:11%"><col style="width:14%"><col style="width:17%"></colgroup>
  <thead><tr>
    <th class="c">ردیف</th>
    <th>شرح کالا</th>
    <th>نوع چله</th>
    <th class="n">وزن<small>کیلوگرم</small></th>
    <th class="n">فی<small>ریال</small></th>
    <th class="n">مبلغ کل<small>ریال</small></th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr>
    <td class="lbl" colspan="3">جمع وزن (${toFaDigits(inv.items.length)} قلم)</td>
    <td class="n">${fmtWeight(totalWeight)}</td>
    <td></td>
    <td class="n">${fmtRial(t.subtotal)}</td>
  </tr></tfoot>
</table>

<div class="bottom">
  <div class="side">
    <div class="words"><span class="k">مبلغ مانده حساب به حروف</span><span class="v">${numberToWords(t.balance)} ریال</span></div>
    ${inv.note ? `<div class="note"><b>توضیحات:</b>${e(inv.note)}</div>` : ""}
  </div>
  <table class="totals">
    <tr><th>جمع کل صورت‌حساب</th><td><span class="n">${fmtRial(t.subtotal)}</span><span class="cur">ریال</span></td></tr>
    <tr><th>${e(inv.expenseTitle || "هزینه")}</th><td><span class="n">${fmtRial(t.expense)}</span><span class="cur">ریال</span></td></tr>
    <tr class="grand"><th>مانده حساب</th><td><span class="n">${fmtRial(t.balance)}</span><span class="cur">ریال</span></td></tr>
  </table>
</div>

<div class="sign">
  <div>مهر و امضای فروشنده</div>
  <div>امضای خریدار</div>
</div>
${co.footerNote ? `<footer>${e(co.footerNote)}</footer>` : ""}
</div></body></html>`;
}
