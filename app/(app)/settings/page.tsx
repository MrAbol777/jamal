import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { StatusCard } from "@/components/status-card";
import { getSystemStatus } from "@/lib/status";
import { RestoreCard } from "./restore-card";
import { SettingsForms } from "./settings-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [s, status] = await Promise.all([db.setting.findUniqueOrThrow({ where: { id: 1 } }), getSystemStatus()]);
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <PageHeader title="تنظیمات" />
      <StatusCard status={status} />
      <RestoreCard />
      <SettingsForms s={{ companyName: s.companyName, subtitle: s.subtitle, address: s.address, phone: s.phone, mobile: s.mobile, managerName: s.managerName, footerNote: s.footerNote, logo: s.logo }} />
    </div>
  );
}
