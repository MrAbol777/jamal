import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// اطلاعات ورود پیش‌فرض. بعد از اولین ورود از صفحه «تنظیمات» رمز را عوض کنید.
const USERNAME = process.env.ADMIN_USERNAME ?? "admin";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "jamal1405";

async function main() {
  await db.user.upsert({
    where: { username: USERNAME },
    update: {},
    create: { username: USERNAME, passwordHash: await bcrypt.hash(PASSWORD, 10) },
  });

  await db.setting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      companyName: "صنایع چله پیچی جمال",
      subtitle: "انواع چله های مبلی _ پرده ای _ روفرشی _ پیراهنی _شال _ روسری _ ترمه",
      address: "یزد بلوار استقلال خیابان سلک باف کوچه برلیان",
      phone: "03535264456",
      mobile: "09133561226",
      managerName: "جمال دوست گل",
      footerNote: "",
    },
  });

  if ((await db.product.count()) === 0 && process.env.SEED_DEMO !== "0") {
    await db.product.createMany({
      data: [
        { name: "نخ پنبه‌ای (نمونه)", price: 1_850_000 },
        { name: "نخ پلی‌استر (نمونه)", price: 1_420_000 },
      ],
    });
    await db.customer.create({ data: { name: "آقای نمونه", phone: "09120000000" } });
  }
}

main().finally(() => db.$disconnect());
