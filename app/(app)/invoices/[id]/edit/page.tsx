import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { dateToJ, todayJ } from "@/lib/jalali";
import { fmtInvoiceNo } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { HeaderForm } from "./header-form";

export const dynamic = "force-dynamic";

export default async function EditStatementHeader({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const inv = await db.invoice.findUnique({
    where: { id },
    select: { id: true, year: true, number: true, date: true, expenseTitle: true, expenseAmount: true, customer: { select: { name: true } } },
  });
  if (!inv) notFound();
  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <PageHeader title="ویرایش صورتحساب" sub={`${inv.customer.name} · ${fmtInvoiceNo(inv.year, inv.number)}`} back={`/invoices/${id}`} />
      <HeaderForm
        id={id}
        baseYear={todayJ().y}
        initial={{ date: dateToJ(inv.date), expenseTitle: inv.expenseTitle, expenseAmount: inv.expenseAmount }}
      />
    </div>
  );
}
