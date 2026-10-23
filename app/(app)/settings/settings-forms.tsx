"use client";

import { useActionState, useState } from "react";
import { changePassword, saveSettings, type ActionResult } from "@/app/actions";
import { IconBuilding, IconCheck, IconLock, IconSpinner, IconUpload } from "@/components/icons";

type S = { companyName: string; address: string; phone: string; footerNote: string; logo: string | null };

export function SettingsForms({ s }: { s: S }) {
  const [a, saveAction, p1] = useActionState<ActionResult, FormData>(saveSettings, {});
  const [b, pwAction, p2] = useActionState<ActionResult, FormData>(changePassword, {});
  const [fileName, setFileName] = useState("");
  return (
    <>
      {/* React فرم را پس از اجرای action ریست می‌کند؛ نام فایل نمایش‌داده‌شده هم پاک شود */}
      <form action={saveAction} onSubmit={() => setFileName("")} className="card space-y-4">
        <div>
          <h2 className="card-title">
            <IconBuilding size={20} />
            اطلاعات بالای فاکتور
          </h2>
          <p className="help !mt-1">این اطلاعات روی همه فاکتورها (پیش‌نمایش و PDF) چاپ می‌شود.</p>
        </div>
        <div>
          <label className="label" htmlFor="s-name">نام شرکت</label>
          <input id="s-name" name="companyName" className="input" defaultValue={s.companyName} required />
        </div>
        <div>
          <label className="label" htmlFor="s-addr">آدرس</label>
          <input id="s-addr" name="address" className="input" defaultValue={s.address} />
        </div>
        <div>
          <label className="label" htmlFor="s-phone">تلفن</label>
          <input id="s-phone" name="phone" className="input num" inputMode="tel" defaultValue={s.phone} />
          <p className="help">در سربرگ فاکتور، کنار نام و آدرس شرکت چاپ می‌شود.</p>
        </div>
        <div>
          <label className="label" htmlFor="s-footer">متن پایین فاکتور (اختیاری)</label>
          <textarea id="s-footer" name="footerNote" rows={2} className="input !py-3 resize-y" defaultValue={s.footerNote} />
          <p className="help">یک جمله ثابت که پایین همه فاکتورها چاپ می‌شود؛ مثلاً شماره حساب بانکی، شرایط فروش یا تشکر از خرید.</p>
        </div>
        <div>
          <label className="label" htmlFor="s-logo">لوگو</label>
          <div className="flex items-center gap-3">
            {s.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.logo} alt="لوگوی فعلی" className="w-14 h-14 shrink-0 object-contain rounded-xl border border-line bg-white p-1" />
            )}
            <label className="input flex items-center gap-3 cursor-pointer min-w-0 focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--ring)]">
              <span className="btn btn-soft !min-h-9 !py-1 !px-3 text-sm shrink-0">
                <IconUpload size={18} />
                انتخاب فایل
              </span>
              <span className={`truncate text-sm ${fileName ? "" : "text-muted"}`}>{fileName || "فایلی انتخاب نشده"}</span>
              <input
                id="s-logo"
                name="logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
              />
            </label>
          </div>
          <p className="help">PNG، JPG یا SVG، حداکثر ۵۰۰ کیلوبایت. برای چاپ سیاه‌وسفید، لوگوی تک‌رنگ بهتر است.</p>
          {s.logo && (
            <label className="flex items-center gap-3 mt-2 text-sm min-h-11 cursor-pointer">
              <input type="checkbox" name="removeLogo" className="w-5 h-5 accent-[var(--brand)]" /> حذف لوگو (استفاده از لوگوی پیش‌فرض)
            </label>
          )}
        </div>
        {a.error && <p className="alert alert-error" role="alert">{a.error}</p>}
        {a.ok && !p1 && (
          <p className="alert alert-ok" role="status">
            <IconCheck size={20} />
            تنظیمات ذخیره شد
          </p>
        )}
        <button className="btn btn-primary w-full" disabled={p1}>
          {p1 ? <IconSpinner size={20} /> : <IconCheck size={20} />}
          {p1 ? "در حال ذخیره..." : "ذخیره تنظیمات"}
        </button>
      </form>

      <form action={pwAction} className="card space-y-4">
        <h2 className="card-title">
          <IconLock size={20} />
          تغییر رمز عبور
        </h2>
        <div>
          <label className="label" htmlFor="pw-cur">رمز فعلی</label>
          <input id="pw-cur" name="current" type="password" className="input num" autoComplete="current-password" required />
        </div>
        <div>
          <label className="label" htmlFor="pw-new">رمز جدید</label>
          <input id="pw-new" name="next" type="password" className="input num" autoComplete="new-password" required />
        </div>
        {b.error && <p className="alert alert-error" role="alert">{b.error}</p>}
        {b.ok && !p2 && (
          <p className="alert alert-ok" role="status">
            <IconCheck size={20} />
            رمز عبور تغییر کرد
          </p>
        )}
        <button className="btn btn-ghost w-full" disabled={p2}>
          {p2 && <IconSpinner size={20} />}
          تغییر رمز
        </button>
      </form>
    </>
  );
}
