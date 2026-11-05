import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const HOUR = 60 * 60 * 1000;

/**
 * بررسی سلامت و فعال نگه داشتن دیتابیس (پلن رایگان سوپابیس بعد از یک هفته بی‌فعالیتی متوقف می‌شود).
 * آخرین فراخوانی در جدول تنظیمات ثبت می‌شود (حداکثر ساعتی یک بار) تا هشدار توقف دیتابیس نشان داده شود.
 */
export async function GET() {
  try {
    const s = await db.setting.findUnique({ where: { id: 1 }, select: { lastKeepaliveAt: true } });
    if (!s?.lastKeepaliveAt || Date.now() - s.lastKeepaliveAt.getTime() > HOUR) {
      await db.setting.update({ where: { id: 1 }, data: { lastKeepaliveAt: new Date() } }).catch(() => undefined);
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
