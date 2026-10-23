"use client";

import { useState } from "react";
import { IconDownload, IconSpinner } from "@/components/icons";

/** دریافت PDF با نمایش وضعیت «در حال ساخت» (ساخت فایل چند ثانیه طول می‌کشد) */
export function PdfButton({ href, label, hint, primary }: { href: string; label: string; hint: string; primary?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "invoice.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <a
      href={href}
      onClick={download}
      aria-busy={busy}
      className={`btn ${primary ? "btn-primary" : "btn-soft"} !h-auto !py-2 flex-col !gap-0 leading-tight`}
    >
      <span className="flex items-center gap-2">
        {busy ? <IconSpinner size={20} /> : <IconDownload size={20} />}
        <span className="num">PDF {label}</span>
      </span>
      <span className={`text-[0.7rem] font-normal ${failed ? "font-bold" : "opacity-75"}`} role={failed ? "alert" : undefined}>
        {busy ? "در حال ساخت فایل…" : failed ? "خطا؛ دوباره بزنید" : hint}
      </span>
    </a>
  );
}
