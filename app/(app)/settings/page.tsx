import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { IconDownload } from "@/components/icons";
import { RestoreCard } from "./restore-card";
import { SettingsForms } from "./settings-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const s = await db.setting.findUniqueOrThrow({ where: { id: 1 } });
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <PageHeader title="تنظیمات" />
      <section className="card space-y-3">
        <h2 className="card-title">
          <IconDownload size={20} />
          نسخه پشتیبان
        </h2>
        <p className="help">همه مشتری‌ها، محصولات و صورتحساب‌ها را در یک فایل ذخیره کنید. پیشنهاد می‌شود هر چند وقت یک بار دانلود و نگه دارید.</p>
        <a href="/settings/backup" download className="btn btn-soft w-full">
          <IconDownload size={20} />
          دانلود نسخه پشتیبان
        </a>
      </section>
      <RestoreCard />
      <SettingsForms s={{ companyName: s.companyName, subtitle: s.subtitle, address: s.address, phone: s.phone, mobile: s.mobile, managerName: s.managerName, footerNote: s.footerNote, logo: s.logo }} />
    </div>
  );
}
