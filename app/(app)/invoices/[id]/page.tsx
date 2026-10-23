import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvoice } from "@/lib/invoice";
import { fmtInvoiceNo } from "@/lib/format";
import { fmtJ } from "@/lib/jalali";
import { PageHeader } from "@/components/page-header";
import { IconPencil } from "@/components/icons";
import { DeleteInvoiceButton } from "./delete-button";
import { PdfButton } from "./pdf-button";

export const dynamic = "force-dynamic";

export default async function InvoiceView({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const inv = await getInvoice(id);
  if (!inv) notFound();

  return (
    <div className="space-y-4">
      <PageHeader title={`فاکتور ${fmtInvoiceNo(inv.year, inv.number)}`} sub={`${inv.customer.name} · ${fmtJ(inv.date)}`} back="/">
        <Link href={`/invoices/${id}/edit`} className="icon-btn" aria-label="ویرایش فاکتور" title="ویرایش">
          <IconPencil size={20} />
        </Link>
        <DeleteInvoiceButton id={id} />
      </PageHeader>

      <div className="card !p-3 space-y-2">
        <p className="text-sm font-bold text-slate-600 px-1">دریافت فایل PDF</p>
        <div className="grid grid-cols-2 gap-2">
          <PdfButton href={`/invoices/${id}/pdf?size=a4`} label="A4" hint="برگه بزرگ" primary />
          <PdfButton href={`/invoices/${id}/pdf?size=a5`} label="A5" hint="برگه کوچک" />
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-slate-50 text-sm text-muted">
          <span>پیش‌نمایش</span>
        </div>
        <iframe src={`/invoices/${id}/html`} title="پیش‌نمایش فاکتور" className="block w-full h-[72dvh] bg-white" />
      </div>
    </div>
  );
}
