"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconSpinner, IconUpload } from "@/components/icons";
import { toFaDigits } from "@/lib/format";

/** بازگردانی نسخه پشتیبان (فقط روی سیستم خالی؛ مثلاً بعد از انتقال به سرور جدید) */
export function RestoreCard() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function restore() {
    const file = input.current?.files?.[0];
    if (!file) return setError("ابتدا فایل پشتیبان را انتخاب کنید");
    if (!confirm("اطلاعات این فایل در سیستم بازگردانی شود؟ (فقط روی سیستم خالی انجام می‌شود)")) return;
    setBusy(true);
    setError("");
    setDone("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/settings/restore", { method: "POST", body: fd });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) throw new Error(out.error || "بازگردانی انجام نشد");
      const c = out.counts;
      setDone(`بازگردانی شد: ${toFaDigits(c.customers)} مشتری، ${toFaDigits(c.products)} محصول، ${toFaDigits(c.invoices)} صورتحساب، ${toFaDigits(c.items)} ردیف`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3">
      <h2 className="card-title">
        <IconUpload size={20} />
        بازگردانی نسخه پشتیبان
      </h2>
      <p className="help">برای انتقال به سرور جدید: فایل پشتیبانی که از سیستم قبلی دانلود کرده‌اید را اینجا انتخاب کنید. فقط روی سیستم خالی کار می‌کند و چیزی را رونویسی نمی‌کند.</p>
      <label className="input flex items-center gap-3 cursor-pointer min-w-0">
        <span className="btn btn-soft !min-h-9 !py-1 !px-3 text-sm shrink-0">انتخاب فایل</span>
        <span className={`truncate text-sm ${fileName ? "" : "text-muted"}`}>{fileName || "فایلی انتخاب نشده"}</span>
        <input ref={input} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} />
      </label>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {done && (
        <p className="alert alert-ok" role="status">
          <IconCheck size={20} />
          {done}
        </p>
      )}
      <button type="button" className="btn btn-ghost w-full" disabled={busy} onClick={restore}>
        {busy ? <IconSpinner size={20} /> : <IconUpload size={20} />}
        {busy ? "در حال بازگردانی..." : "بازگردانی"}
      </button>
    </section>
  );
}
