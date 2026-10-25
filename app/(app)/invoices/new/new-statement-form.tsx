"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createStatement, saveCustomer } from "@/app/actions";
import { toFaDigits } from "@/lib/format";
import type { J } from "@/lib/jalali";
import { DateFields } from "@/components/date-fields";
import { IconCheck, IconChevron, IconInvoice, IconPlus, IconSpinner, IconUser } from "@/components/icons";

export type CustomerOpt = { id: number; name: string; statements: { id: number; no: string; date: string }[] };

export function NewStatementForm({ customers: initial, today, initialCustomerId }: { customers: CustomerOpt[]; today: J; initialCustomerId: number }) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initial);
  const [customerId, setCustomerId] = useState(initialCustomerId);
  const [date, setDate] = useState<J>(today);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const [newCust, setNewCust] = useState<{ name: string; phone: string } | null>(null);
  const [custError, setCustError] = useState("");
  const [custPending, startCust] = useTransition();

  const chosen = customers.find((c) => c.id === customerId);

  function addCustomer() {
    if (!newCust) return;
    setCustError("");
    startCust(async () => {
      const r = await saveCustomer({ name: newCust.name, phone: newCust.phone, address: "" });
      if (r.error || !r.id) return setCustError(r.error ?? "خطا در ذخیره مشتری");
      const c = { id: r.id, name: newCust.name.trim(), statements: [] };
      setCustomers((cs) => [...cs, c].sort((a, b) => a.name.localeCompare(b.name, "fa")));
      setCustomerId(r.id);
      setNewCust(null);
      setError("");
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!customerId) return setError("مشتری را انتخاب کنید");
    start(async () => {
      const r = await createStatement(customerId, date);
      if (r.error || !r.id) return setError(r.error ?? "خطا در ساخت صورتحساب");
      router.replace(`/invoices/${r.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <label className="label" htmlFor="customer">مشتری</label>
        <div className="flex gap-2">
          <select id="customer" className="input min-w-0" value={customerId} onChange={(e) => { setCustomerId(+e.target.value); setError(""); }}>
            <option value={0}>انتخاب کنید…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-soft !px-0 w-12 shrink-0"
            onClick={() => {
              setNewCust(newCust ? null : { name: "", phone: "" });
              setCustError("");
            }}
            aria-label="افزودن مشتری جدید"
            aria-expanded={!!newCust}
            title="مشتری جدید"
          >
            <IconPlus size={22} />
          </button>
        </div>

        {newCust && (
          <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-line space-y-2">
            <p className="text-sm font-bold flex items-center gap-1.5 text-slate-600">
              <IconUser size={18} />
              مشتری جدید
            </p>
            <input
              className="input"
              placeholder="نام مشتری"
              aria-label="نام مشتری جدید"
              autoFocus
              value={newCust.name}
              onChange={(e) => setNewCust({ ...newCust, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomer();
                }
              }}
            />
            <input
              className="input num"
              inputMode="tel"
              placeholder="تلفن (اختیاری)"
              aria-label="تلفن مشتری جدید"
              value={newCust.phone}
              onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
            />
            {custError && <p className="alert alert-error" role="alert">{custError}</p>}
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary flex-1" onClick={addCustomer} disabled={custPending}>
                {custPending ? <IconSpinner size={20} /> : <IconCheck size={20} />}
                ذخیره مشتری
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setNewCust(null); setCustError(""); }}>
                انصراف
              </button>
            </div>
          </div>
        )}

        {chosen && chosen.statements.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-1">
            <p>
              «{chosen.name}» {toFaDigits(chosen.statements.length)} صورتحساب دارد. برای افزودن فروش جدید معمولاً کافی است همان را باز کنید:
            </p>
            <ul>
              {chosen.statements.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <Link href={`/invoices/${s.id}`} className="flex items-center gap-2 min-h-11 font-bold underline-offset-4 hover:underline">
                    <IconInvoice size={18} className="shrink-0" />
                    <span className="tabular-nums">{s.no}</span>
                    <span className="font-normal text-amber-800">· {s.date}</span>
                    <IconChevron size={18} className="mr-auto shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <DateFields label="تاریخ فاکتور" value={date} onChange={setDate} baseYear={today.y} />

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      <button className="btn btn-primary w-full" disabled={pending || custPending}>
        {pending ? <IconSpinner size={20} /> : <IconCheck size={20} />}
        {pending ? "در حال ساخت…" : "ساخت صورتحساب"}
      </button>
    </form>
  );
}
