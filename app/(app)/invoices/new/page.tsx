import { db } from "@/lib/db";
import { fmtInvoiceNo } from "@/lib/format";
import { fmtJ, todayJ } from "@/lib/jalali";
import { PageHeader } from "@/components/page-header";
import { NewStatementForm, type CustomerOpt } from "./new-statement-form";

export const dynamic = "force-dynamic";

export default async function NewStatement({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const pre = Number((await searchParams).customer) || 0;
  const rows = await db.customer.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      invoices: { select: { id: true, year: true, number: true, date: true }, orderBy: [{ date: "desc" }, { id: "desc" }] },
    },
  });
  const customers: CustomerOpt[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    statements: c.invoices.map((i) => ({ id: i.id, no: fmtInvoiceNo(i.year, i.number), date: fmtJ(i.date) })),
  }));
  const today = todayJ();

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      <PageHeader title="صورتحساب جدید" sub="برای هر مشتری یک صورتحساب؛ فروش‌ها بعداً ردیف‌به‌ردیف اضافه می‌شوند" back="/" />
      <NewStatementForm customers={customers} today={today} initialCustomerId={customers.some((c) => c.id === pre) ? pre : 0} />
    </div>
  );
}
