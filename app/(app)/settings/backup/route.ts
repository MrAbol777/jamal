import { getUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { exportBackup } from "@/lib/backup";
import { backupFileName } from "@/lib/jalali";

export const runtime = "nodejs";

/** دانلود نسخه پشتیبان کامل داده‌ها (JSON)؛ رمزها در آن نیست. زمان دانلود برای یادآوری ثبت می‌شود. */
export async function GET() {
  if (!(await getUserId())) return new Response("Unauthorized", { status: 401 });
  const now = new Date();
  const body = JSON.stringify(await exportBackup(), null, 2);
  // ثبت زمان آخرین بکاپ (فقط برای نوار یادآوری)؛ خطا نباید دانلود را خراب کند
  await db.setting.update({ where: { id: 1 }, data: { lastBackupAt: now } }).catch(() => undefined);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${backupFileName(now)}"`,
      "cache-control": "no-store",
    },
  });
}
