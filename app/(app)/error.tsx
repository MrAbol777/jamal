"use client";

import { IconSpinner } from "@/components/icons";

/** اگر دیتابیس یا سرور جواب ندهد، به‌جای صفحه‌ی خطای انگلیسی این پیام نشان داده می‌شود */
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card empty max-w-md mx-auto" role="alert">
      <span className="empty-icon">
        <IconSpinner size={30} />
      </span>
      <b className="text-fg">اتصال به دیتابیس برقرار نشد</b>
      <p className="text-sm leading-7">اطلاعات شما پاک نشده است. این مشکل معمولاً موقتی است؛ چند لحظه صبر کنید و دوباره امتحان کنید.</p>
      <button type="button" className="btn btn-primary mt-2" onClick={reset}>
        تلاش دوباره
      </button>
    </div>
  );
}
