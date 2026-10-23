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
      companyName: "شرکت ریسندگی نخ",
      address: "آدرس شرکت را از بخش تنظیمات وارد کنید",
      phone: "۰۲۱-۰۰۰۰۰۰۰۰",
      footerNote: "",
    },
  });

  if ((await db.product.count()) === 0 && process.env.SEED_DEMO !== "0") {
    await db.product.create({
      data: {
        name: "نخ پنبه‌ای (نمونه)",
        price: 1_850_000,
        cheles: { create: [{ name: "چله ۳۰/۱" }, { name: "چله ۲۰/۱" }] },
      },
    });
    await db.product.create({
      data: {
        name: "نخ پلی‌استر (نمونه)",
        price: 1_420_000,
        cheles: { create: [{ name: "چله ۴۰/۱" }] },
      },
    });
    await db.customer.create({ data: { name: "مشتری نمونه", phone: "09120000000" } });
  }
}

main().finally(() => db.$disconnect());
