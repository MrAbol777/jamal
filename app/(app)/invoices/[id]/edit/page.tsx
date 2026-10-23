import { notFound } from "next/navigation";
import { getInvoice } from "@/lib/invoice";
import { toJ, todayJ } from "@/lib/jalali";
import { fmtInvoiceNo } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { InvoiceForm } from "../../invoice-form";
import { loadFormData } from "../../load";

export const dynamic = "force-dynamic";

export default async function EditInvoice({ params }: { params: Promise<{ id: string }> }) {
  const inv = await getInvoice(Number((await params).id));
  if (!inv) notFound();
  const data = await loadFormData();
  // اگر مشتری فاکتور بعداً غیرفعال شده باشد باز هم در لیست باشد
  const d = inv.date;
  const date = toJ(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <PageHeader title="ویرایش فاکتور" sub={`شماره ${fmtInvoiceNo(inv.year, inv.number)}`} back={`/invoices/${inv.id}`} />
      <InvoiceForm
        {...data}
        today={todayJ()}
        initial={{
          id: inv.id,
          date,
          havaleNo: inv.havaleNo,
          customerId: inv.customerId,
          paymentType: inv.paymentType,
          expenseTitle: inv.expenseTitle,
          expenseAmount: inv.expenseAmount,
          note: inv.note,
          items: inv.items.map((i) => ({ productId: i.productId, productName: i.productName, cheleName: i.cheleName, weight: i.weight, fee: i.fee })),
        }}
      />
    </div>
  );
}
