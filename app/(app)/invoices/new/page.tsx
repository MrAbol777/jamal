import Link from "next/link";
import { todayJ } from "@/lib/jalali";
import { PageHeader } from "@/components/page-header";
import { InvoiceForm } from "../invoice-form";
import { loadFormData } from "../load";

export const dynamic = "force-dynamic";

export default async function NewInvoice() {
  const data = await loadFormData();
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <PageHeader title="فاکتور جدید" back="/" />
      {data.products.length === 0 && (
        <div className="alert bg-amber-50 text-amber-900 border border-amber-200">
          <span>
            ابتدا از بخش{" "}
            <Link href="/products/new" className="font-bold underline underline-offset-4">محصولات</Link>{" "}
            حداقل یک محصول ثبت کنید.
          </span>
        </div>
      )}
      <InvoiceForm {...data} today={todayJ()} />
    </div>
  );
}
