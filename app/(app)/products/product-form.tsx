"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProduct, saveProduct } from "@/app/actions";
import { toEnDigits, toFaDigits } from "@/lib/format";
import { IconCheck, IconClose, IconPlus, IconSpinner, IconTrash } from "@/components/icons";

const sep = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function ProductForm({ initial }: { initial?: { id: number; name: string; price: number; cheles: string[] } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState("");
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial?.price ? String(initial.price) : "");
  const [cheles, setCheles] = useState<string[]>(initial?.cheles.length ? initial.cheles : [""]);
  const busy = pending || deleting;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await saveProduct({ id: initial?.id, name, price, cheles });
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
          <p className="help">هنگام ثبت فاکتور می‌توانید فی را برای همان فاکتور تغییر دهید.</p>
        </div>
      </div>

      <div className="card space-y-3">
        <div>
          <b className="card-title">انواع چله</b>
          <p className="help !mt-1">هر نوع چله‌ای که این نخ با آن فروخته می‌شود؛ در فاکتور از همین فهرست انتخاب می‌شود.</p>
        </div>
        {cheles.map((c, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="input"
              value={c}
              aria-label={`نوع چله ${toFaDigits(i + 1)}`}
              placeholder="مثلاً چله ۳۰/۱"
              onChange={(e) => setCheles((cs) => cs.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <button
              type="button"
              className="icon-btn icon-btn-danger !w-12 !h-12"
              aria-label="حذف این نوع چله"
              title="حذف"
              onClick={() => setCheles((cs) => (cs.length > 1 ? cs.filter((_, j) => j !== i) : [""]))}
            >
              <IconClose size={20} />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-soft w-full" onClick={() => setCheles((cs) => [...cs, ""])}>
          <IconPlus size={20} />
          افزودن نوع چله
        </button>
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
