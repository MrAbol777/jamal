import { getUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { getInvoice } from "@/lib/invoice";
import { invoiceHtml } from "@/lib/invoice-html";
import { htmlToPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getUserId())) return new Response("Unauthorized", { status: 401 });
  const inv = await getInvoice(Number((await params).id));
  if (!inv) return new Response("Not found", { status: 404 });
  const size = new URL(req.url).searchParams.get("size") === "a5" ? "a5" : "a4";
  const co = await db.setting.findUniqueOrThrow({ where: { id: 1 } });
  const pdf = await htmlToPdf(invoiceHtml(inv, co, size), size);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="invoice-${inv.year}${String(inv.number).padStart(4, "0")}-${size}.pdf"`,
    },
  });
}
