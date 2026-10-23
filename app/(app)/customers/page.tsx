import { db } from "@/lib/db";
import { toFaDigits } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { CustomerManager } from "./customer-manager";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await db.customer.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-4">
      <PageHeader title="مشتری‌ها" sub={customers.length ? `${toFaDigits(customers.length)} مشتری` : undefined} />
      <CustomerManager customers={customers} />
    </div>
  );
}
