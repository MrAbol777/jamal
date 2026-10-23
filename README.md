# حسابداری فروش نخ

وب‌اپ فارسی و راست‌چین برای ثبت فروش و صدور فاکتور PDF (Next.js + PostgreSQL/Supabase + Prisma).

## متغیرهای محیطی
`.env.example` را ببینید. چهار مقدار لازم است: `DATABASE_URL`، `DIRECT_URL`، `SESSION_SECRET`، `COOKIE_SECURE`.

## اجرای محلی
```bash
npm install
npm run dev        # http://localhost:3000
```
PDF با Chrome/Edge نصب‌شده ساخته می‌شود (`CHROME_PATH` برای مسیر دلخواه).

## دیتابیس
- جدول‌ها: `prisma/migrations/*/migration.sql` (اعمال با `npm run db:deploy` یا SQL editor سوپابیس).
- کاربر ادمین: `npm run db:seed` (با `ADMIN_USERNAME` و `ADMIN_PASSWORD`).

## استقرار روی Render (Docker)
`Dockerfile` و `render.yaml` آماده‌اند. در Render یک Web Service از همین ریپو بسازید و متغیرهای بالا را وارد کنید.
برای `DATABASE_URL` از آدرس **Transaction pooler** سوپابیس (پورت ۶۵۴۳) با `?pgbouncer=true&connection_limit=1` استفاده کنید
(آدرس مستقیم فقط IPv6 است).
