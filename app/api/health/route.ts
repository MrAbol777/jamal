import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** بررسی سلامت و فعال نگه داشتن دیتابیس (پلن رایگان سوپابیس بعد از یک هفته بی‌فعالیتی متوقف می‌شود) */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
