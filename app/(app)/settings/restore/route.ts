import { getUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { importBackup } from "@/lib/backup";

export const runtime = "nodejs";
export const maxDuration = 60;

/** بازگردانی نسخه پشتیبان؛ فقط روی سیستم خالی (بدون مشتری، محصول و صورتحساب) */
export async function POST(req: Request) {
  if (!(await getUserId())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return Response.json({ error: "فایل پشتیبان را انتخاب کنید" }, { status: 400 });
    if (file.size > 50_000_000) return Response.json({ error: "حجم فایل بیش از حد است" }, { status: 400 });
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return Response.json({ error: "فایل پشتیبان نامعتبر است (JSON خراب)" }, { status: 400 });
    }
    const counts = await db.$transaction((tx) => importBackup(tx, data), { timeout: 120_000, maxWait: 20_000 });
    return Response.json({ ok: true, counts });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "خطا در بازگردانی" }, { status: 400 });
  }
}
