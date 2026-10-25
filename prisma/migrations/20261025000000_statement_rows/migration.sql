-- صورتحساب ادامه‌دار: هر ردیف تاریخ و شماره حواله خودش را دارد؛ چله حذف شد.
DROP TABLE "Chele";

ALTER TABLE "Setting"
  ADD COLUMN "subtitle" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "mobile" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "managerName" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Invoice"
  DROP COLUMN "havaleNo",
  DROP COLUMN "paymentType",
  DROP COLUMN "note";

ALTER TABLE "InvoiceItem"
  DROP COLUMN "cheleName",
  ALTER COLUMN "weight" DROP NOT NULL,
  ALTER COLUMN "fee" DROP NOT NULL,
  ADD COLUMN "date" TIMESTAMP(3),
  ADD COLUMN "havaleNo" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "amount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- ردیف‌های قبلی: تاریخ از فاکتور و مبلغ = وزن×فی
UPDATE "InvoiceItem" it
  SET "date" = i."date", "amount" = ROUND(COALESCE(it."weight", 0) * COALESCE(it."fee", 0))
  FROM "Invoice" i WHERE i."id" = it."invoiceId";
ALTER TABLE "InvoiceItem" ALTER COLUMN "date" SET NOT NULL;

UPDATE "Setting" SET
  "companyName" = 'صنایع چله پیچی جمال',
  "subtitle" = 'انواع چله های مبلی _ پرده ای _ روفرشی _ پیراهنی _شال _ روسری _ ترمه',
  "address" = 'یزد بلوار استقلال خیابان سلک باف کوچه برلیان',
  "phone" = '03535264456',
  "mobile" = '09133561226',
  "managerName" = 'جمال دوست گل'
WHERE "id" = 1;
