import type { SystemStatus } from "@/lib/status";
import { IconDownload } from "./icons";

const Row = ({ level, title, children }: { level: "ok" | "warn" | "alert"; title: string; children?: React.ReactNode }) => (
  <div className="status-row">
    <span className={`status-dot ${level}`} aria-hidden />
    <div className="flex-1 min-w-0">
      <b className="block">{title}</b>
      <div className="text-sm text-muted leading-7">{children}</div>
    </div>
  </div>
);

/** کارت «وضعیت سیستم و پشتیبان‌گیری» در صفحه‌ی تنظیمات */
export function StatusCard({ status }: { status: SystemStatus }) {
  const { backup, platform } = status;
  return (
    <section id="status" className="card space-y-1 scroll-mt-20">
      <h2 className="card-title mb-2">
        <IconDownload size={20} />
        وضعیت سیستم و نسخه پشتیبان
      </h2>

      <Row level={backup.level} title="نسخه‌ی پشتیبان">
        {backup.text}.
        <br />
        فایل را در دو جا (کامپیوتر و گوگل‌درایو) نگه دارید. اگر بیش از {"۷"} روز بگذرد هشدار زرد و بعد از {"۱۴"} روز هشدار قرمز می‌بینید.
      </Row>

      <Row level={status.dbOk ? "ok" : "alert"} title="اتصال به دیتابیس">
        {status.dbOk ? "برقرار است." : "برقرار نیست؛ اطلاعات پاک نشده، کمی بعد دوباره امتحان کنید."}
      </Row>

      {platform.keepalive && (
        <Row level={platform.keepalive.level} title="نگه‌دارنده‌ی خودکار دیتابیس (Supabase رایگان)">
          {platform.keepalive.text}.
          <br />
          دیتابیس رایگان اگر {"۷"} روز بی‌فعالیت بماند متوقف می‌شود؛ این کار هر روز خودکار انجام می‌شود تا این اتفاق نیفتد.
        </Row>
      )}

      {platform.dbSize && (
        <Row level={platform.dbSize.level} title="حجم دیتابیس">
          {platform.dbSize.text}
          <div className={`meter ${platform.dbSize.level}`} role="img" aria-label={`${platform.dbSize.pct} درصد`}>
            <span style={{ width: `${Math.max(2, platform.dbSize.pct)}%` }} />
          </div>
        </Row>
      )}

      {platform.isNetlify && (
        <Row level="ok" title="هاستینگ رایگان (Netlify)">
          اعتبار پلن رایگان ماهانه است (۳۰۰ واحد در هر دوره) و هر ماه تمدید می‌شود. اگر سایت ناگهان باز نشد، ممکن است اعتبار همان دوره تمام شده باشد؛ نسخه‌ی پشتیبان را دور از دسترس سایت هم نگه دارید.
        </Row>
      )}

      <a href="/settings/backup" download className="btn btn-primary w-full !mt-3">
        <IconDownload size={20} />
        دانلود نسخه پشتیبان
      </a>
    </section>
  );
}
