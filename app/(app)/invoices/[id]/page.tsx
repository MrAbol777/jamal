import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { calcTotals, getInvoice } from "@/lib/invoice";
import { fmtInvoiceNo, fmtRial } from "@/lib/format";
import { dateToJ, fmtJ, todayJ } from "@/lib/jalali";
import { PageHeader } from "@/components/page-header";
import { IconInvoice, IconPencil } from "@/components/icons";
import { DeleteInvoiceButton } from "./delete-button";
import { PdfButton } from "./pdf-button";
import { StatementRows, type RowData } from "./rows";

export const dynamic = "force-dynamic";

export default async function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [inv, products] = await Promise.all([
    getInvoice(id),
    db.product.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, price: true } }),
  ]);
  if (!inv) notFound();

  const t = calcTotals(inv.items, inv.expenseAmount);
  // ترتیب چاپ (تاریخ صعودی) → شماره ردیف؛ نمایش: جدیدترین بالا
  const rows: RowData[] = inv.items
    .map((it, i) => ({
      id: it.id,
      no: i + 1,
      date: dateToJ(it.date),
      dateStr: fmtJ(it.date),
      havaleNo: it.havaleNo,
      productId: it.productId,
      productName: it.productName,
      weight: it.weight,
      fee: it.fee,
      amount: it.amount,
    }))
    .reverse();

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <PageHeader
        // نام مشتری مهم‌ترین بخش عنوان است؛ روی گوشی به‌جای بریده شدن به خط بعد می‌رود
        title={<span className="whitespace-normal break-words">صورتحساب {inv.customer.name}</span>}
        sub={`${fmtInvoiceNo(inv.year, inv.number)} · ${fmtJ(inv.date)}`} back="/">
        <Link href={`/invoices/${id}/edit`} className="icon-btn" aria-label="ویرایش تاریخ و هزینه صورتحساب" title="ویرایش">
          <IconPencil size={20} />
        </Link>
        <DeleteInvoiceButton id={id} />
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <section className="card" aria-label="جمع صورتحساب">
          <dl className="space-y-1.5 text-[0.95rem]">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">جمع کل صورتحساب</dt>
              <dd className="tabular-nums">{fmtRial(t.subtotal)} ریال</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted truncate">{inv.expenseTitle || "هزینه"}</dt>
              <dd className="tabular-nums">{fmtRial(t.expense)} ریال</dd>
            </div>
            <div className="flex justify-between items-baseline gap-2 border-t border-line pt-2 mt-1">
              <dt className="font-bold">مانده حساب</dt>
              <dd className="font-bold text-xl tabular-nums text-brand">
                {fmtRial(t.balance)} <span className="text-xs font-normal text-muted">ریال</span>
              </dd>
            </div>
          </dl>
        </section>

        <section className="card !p-3 space-y-2" aria-label="دریافت PDF">
          <div className="flex items-center justify-between gap-2 px-1 min-h-11">
            <p className="text-sm font-bold text-slate-600">دریافت فایل PDF</p>
            <a href={`/invoices/${id}/html`} target="_blank" rel="noopener" className="btn btn-ghost !min-h-11 !py-1 !px-3 text-sm">
              <IconInvoice size={18} />
              پیش‌نمایش
            </a>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <PdfButton href={`/invoices/${id}/pdf?size=a4`} label="A4" hint="برگه بزرگ" primary />
            <PdfButton href={`/invoices/${id}/pdf?size=a5`} label="A5" hint="برگه کوچک" />
          </div>
        </section>
      </div>

      <StatementRows invoiceId={id} rows={rows} products={products} today={todayJ()} />
    </div>
  );
}
