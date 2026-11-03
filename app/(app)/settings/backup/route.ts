import { getUserId } from "@/lib/auth";
import { exportBackup } from "@/lib/backup";

export const runtime = "nodejs";

/** دانلود نسخه پشتیبان کامل داده‌ها (JSON)؛ رمزها در آن نیست */
export async function GET() {
  if (!(await getUserId())) return new Response("Unauthorized", { status: 401 });
  const body = JSON.stringify(await exportBackup(), null, 2);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="backup-${day}.json"`,
      "cache-control": "no-store",
    },
  });
}
