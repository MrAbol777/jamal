"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProduct, saveProduct } from "@/app/actions";
import { toEnDigits } from "@/lib/format";
import { IconCheck, IconSpinner, IconTrash } from "@/components/icons";

const sep = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function ProductForm({ initial }: { initial?: { id: number; name: string; price: number } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState("");
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial?.price ? String(initial.price) : "");
  const busy = pending || deleting;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await saveProduct({ id: initial?.id, name, price });
      if (r.error) return setError(r.error);
      router.replace("/products");
      router.refresh();
    });
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="card space-y-4">
        <div>
          <label className="label" htmlFor="pname">نام محصول (نوع نخ)</label>
          <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً نخ پنبه‌ای" required />
        </div>
        <div>
          <label className="label" htmlFor="pprice">قیمت پیش‌فرض هر کیلوگرم (ریال)</label>
          <input
            id="pprice"
            className="input num"
            inputMode="numeric"
            value={sep(toEnDigits(price).replace(/\D/g, ""))}
            onChange={(e) => setPrice(toEnDigits(e.target.value).replace(/\D/g, ""))}
            placeholder="0"
          />
          <p className="help">هنگام ثبت هر ردیف صورتحساب می‌توانید فی را برای همان ردیف تغییر دهید.</p>
        </div>
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <div className="grid gap-2">
        <button className="btn btn-primary w-full" disabled={busy}>
          {pending ? <IconSpinner size={20} /> : <IconCheck size={20} />}
          {pending ? "در حال ذخیره..." : "ذخیره محصول"}
        </button>
        {initial && (
          <button
            type="button"
            className="btn btn-danger w-full"
            disabled={busy}
            onClick={() => {
              if (!confirm("این محصول حذف شود؟ فاکتورهای قبلی تغییری نمی‌کنند.")) return;
              startDelete(async () => {
                await deleteProduct(initial.id);
                router.replace("/products");
                router.refresh();
              });
            }}
          >
            {deleting ? <IconSpinner size={20} /> : <IconTrash size={20} />}
            حذف محصول
          </button>
        )}
      </div>
    </form>
  );
}
