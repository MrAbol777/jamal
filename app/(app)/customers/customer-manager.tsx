"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCustomer, saveCustomer } from "@/app/actions";
import { toFaDigits } from "@/lib/format";
import { IconCheck, IconPencil, IconPhone, IconPin, IconPlus, IconSpinner, IconTrash, IconUsers } from "@/components/icons";

type C = { id: number; name: string; phone: string; address: string };
type Draft = Partial<C> & { name: string; phone: string; address: string };
const EMPTY: Draft = { name: "", phone: "", address: "" };

export function CustomerManager({ customers }: { customers: C[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [removing, setRemoving] = useState<number | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");

  function open(d: Draft) {
    setEditing(d);
    setError("");
    setListError("");
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    start(async () => {
      const r = await saveCustomer({ id: editing.id, name: editing.name, phone: editing.phone, address: editing.address });
      if (r.error) return setError(r.error);
      setEditing(null);
      setError("");
      router.refresh();
    });
  }

  function remove(c: C) {
    if (!confirm(`مشتری «${c.name}» حذف شود؟`)) return;
    setRemoving(c.id);
    setListError("");
    start(async () => {
      const r = await deleteCustomer(c.id);
      setRemoving(null);
      if (r.error) return setListError(r.error);
      if (editing?.id === c.id) setEditing(null);
      router.refresh();
    });
  }

  const editor = editing && (
    <form onSubmit={save} className="card space-y-3 ring-2 ring-accent/30 !border-accent/40">
      <b className="card-title">{editing.id ? "ویرایش مشتری" : "مشتری جدید"}</b>
      <div>
        <label className="label" htmlFor="c-name">نام مشتری</label>
        <input id="c-name" className="input" autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
      </div>
      <div>
        <label className="label" htmlFor="c-phone">تلفن (اختیاری)</label>
        <input id="c-phone" className="input num" inputMode="tel" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
      </div>
      <div>
        <label className="label" htmlFor="c-addr">آدرس (اختیاری)</label>
        <input id="c-addr" className="input" value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
        <p className="help">تلفن و آدرس در بخش مشخصات خریدار روی فاکتور چاپ می‌شوند.</p>
      </div>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1" disabled={pending}>
          {pending && removing === null ? <IconSpinner size={20} /> : <IconCheck size={20} />}
          ذخیره
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => { setEditing(null); setError(""); }}>
          انصراف
        </button>
      </div>
    </form>
  );

  return (
    <>
      {editing && !editing.id ? (
        editor
      ) : (
        <button className="btn btn-primary w-full" onClick={() => open({ ...EMPTY })}>
          <IconPlus size={20} />
          مشتری جدید
        </button>
      )}
      {listError && <p className="alert alert-error" role="alert">{listError}</p>}
      {customers.length === 0 ? (
        <div className="card empty">
          <span className="empty-icon"><IconUsers size={30} /></span>
          <b className="text-fg">هنوز مشتری ثبت نشده</b>
          <p className="text-sm">مشتری‌ها را اینجا یا هنگام ثبت فاکتور اضافه کنید.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {customers.map((c) =>
            editing?.id === c.id ? (
              <li key={c.id}>{editor}</li>
            ) : (
              <li key={c.id} className="card flex items-center gap-3 !p-4">
                <span className="grid place-items-center w-11 h-11 shrink-0 rounded-full bg-brand-soft text-brand font-bold">
                  {c.name.trim().charAt(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <b className="block truncate">{c.name}</b>
                  {c.phone || c.address ? (
                    <div className="text-sm text-muted space-y-0.5 min-w-0">
                      {c.phone && (
                        <span className="flex items-center gap-1.5 min-w-0">
                          <IconPhone size={14} className="shrink-0" />
                          <span className="num truncate" dir="ltr">{toFaDigits(c.phone)}</span>
                        </span>
                      )}
                      {c.address && (
                        <span className="flex items-center gap-1.5 min-w-0">
                          <IconPin size={14} className="shrink-0" />
                          <span className="truncate">{c.address}</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-muted">بدون تلفن و آدرس</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" className="icon-btn" aria-label={`ویرایش ${c.name}`} title="ویرایش" onClick={() => open({ ...c })}>
                    <IconPencil size={20} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    aria-label={`حذف ${c.name}`}
                    title="حذف"
                    disabled={pending}
                    onClick={() => remove(c)}
                  >
                    {removing === c.id ? <IconSpinner size={20} /> : <IconTrash size={20} />}
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </>
  );
}
