import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { SettingsForms } from "./settings-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const s = await db.setting.findUniqueOrThrow({ where: { id: 1 } });
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <PageHeader title="تنظیمات" />
      <SettingsForms s={{ companyName: s.companyName, subtitle: s.subtitle, address: s.address, phone: s.phone, mobile: s.mobile, managerName: s.managerName, footerNote: s.footerNote, logo: s.logo }} />
    </div>
  );
}
