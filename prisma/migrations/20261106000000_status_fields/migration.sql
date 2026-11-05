-- یادآوری بکاپ و وضعیت نگه‌دارنده
ALTER TABLE "Setting"
  ADD COLUMN "lastBackupAt" TIMESTAMP(3),
  ADD COLUMN "lastKeepaliveAt" TIMESTAMP(3);
