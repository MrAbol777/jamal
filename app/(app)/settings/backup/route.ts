import { getUserId } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** نسخه پشتیبان کامل داده‌ها (JSON) برای دانلود؛ رمزها در آن نیست */
export async function GET() {
  if (!(await getUserId())) return new Response("Unauthorized", { status: 401 });
  const [setting, products, customers, invoices] = await Promise.all([
    db.setting.findUnique({ where: { id: 1 } }),
    db.product.findMany({ orderBy: { id: "asc" } }),
    db.customer.findMany({ orderBy: { id: "asc" } }),
    db.invoice.findMany({ orderBy: { id: "asc" }, include: { items: { orderBy: { id: "asc" } } } }),
  ]);
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), setting, products, customers, invoices }, null, 2);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="backup-${day}.json"`,
      "cache-control": "no-store",
    },
  });
}
