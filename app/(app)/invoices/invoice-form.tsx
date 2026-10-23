"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveInvoice, saveCustomer } from "@/app/actions";
import { fmtNum, lineTotal, parseNum, toEnDigits, toFaDigits } from "@/lib/format";
import { MONTHS, daysInMonth, type J } from "@/lib/jalali";
import { IconCalendar, IconCheck, IconPlus, IconSpinner, IconTrash, IconUser, IconYarn } from "@/components/icons";

export type ProductOpt = { id: number; name: string; price: number; cheles: string[] };
export type CustomerOpt = { id: number; name: string };
export type InitialInvoice = {
  id: number;
  date: J;
  havaleNo: string;
  customerId: number;
  paymentType: string;
  expenseTitle: string;
  expenseAmount: number;
  note: string;
  items: { productId: number | null; productName: string; cheleName: string; weight: number; fee: number }[];
};

type Row = { key: number; productId: number | null; productName: string; cheleName: string; weight: string; fee: string };

const sep = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const cleanInt = (s: string) => toEnDigits(s).replace(/\D/g, "");
const cleanDec = (s: string) => {
  const t = toEnDigits(s).replace(/[^\d.]/g, "");
  const [a, ...b] = t.split(".");
  return b.length ? `${a}.${b.join("")}` : a;
};

export function InvoiceForm({
  products,
  customers: initialCustomers,
  today,
  initial,
}: {
  products: ProductOpt[];
  customers: CustomerOpt[];
  today: J;
  initial?: InitialInvoice;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  let k = 0;

  const [date, setDate] = useState<J>(initial?.date ?? today);
  const [havale, setHavale] = useState(initial?.havaleNo ?? "");
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState<number>(initial?.customerId ?? 0);
  const [payment, setPayment] = useState(initial?.paymentType ?? "نقدی");
  const [expTitle, setExpTitle] = useState(initial?.expenseTitle ?? "هزینه");
  const [expense, setExpense] = useState(initial?.expenseAmount ? String(initial.expenseAmount) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [rows, setRows] = useState<Row[]>(
    initial
      ? initial.items.map((i) => ({ key: ++k, productId: i.productId, productName: i.productName, cheleName: i.cheleName, weight: String(i.weight), fee: String(i.fee) }))
      : [{ key: 1, productId: null, productName: "", cheleName: "", weight: "", fee: "" }],
  );
  const [nextKey, setNextKey] = useState(100);

  const [newCust, setNewCust] = useState<{ name: string; phone: string } | null>(null);

  const subtotal = useMemo(() => rows.reduce((s, r) => s + lineTotal(parseNum(r.weight), parseNum(r.fee)), 0), [rows]);
  const exp = parseNum(expense);
  const balance = subtotal + exp;

  const years = Array.from({ length: 7 }, (_, i) => today.y - 3 + i);
  const dim = daysInMonth(date.y, date.m);

  const setRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function pickProduct(key: number, id: number) {
    const p = products.find((x) => x.id === id);
    if (!p) return setRow(key, { productId: null, productName: "", cheleName: "", fee: "" });
    setRow(key, { productId: p.id, productName: p.name, cheleName: p.cheles[0] ?? "", fee: p.price ? String(p.price) : "" });
  }

  const [custPending, startCust] = useTransition();
  const [custError, setCustError] = useState("");

  function addCustomer() {
    if (!newCust) return;
    startCust(async () => {
      const r = await saveCustomer({ name: newCust.name, phone: newCust.phone, address: "" });
      if (r.error || !r.id) return setCustError(r.error ?? "خطا");
      setCustomers((c) => [...c, { id: r.id!, name: newCust.name.trim() }].sort((a, b) => a.name.localeCompare(b.name, "fa")));
      setCustomerId(r.id);
      setNewCust(null);
      setCustError("");
    });
  }

  function submit() {
    setError("");
    start(async () => {
      const r = await saveInvoice(initial?.id ?? null, {
        date,
        havaleNo: havale.trim(),
        customerId,
        paymentType: payment,
        expenseTitle: expTitle.trim(),
        expenseAmount: exp,
        note: note.trim(),
        items: rows.map((r) => ({
          productId: r.productId,
          productName: r.productName,
          cheleName: r.cheleName,
          weight: parseNum(r.weight),
          fee: parseNum(r.fee),
        })),
      });
      if (r.error) return setError(r.error);
      router.replace(`/invoices/${r.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* اطلاعات کلی */}
      <section className="card space-y-4">
        <h2 className="card-title">
          <IconCalendar size={20} />
          اطلاعات فاکتور
        </h2>
        <div>
          <span className="label">تاریخ فروش (شمسی)</span>
          <div className="grid grid-cols-[1fr_1.4fr_1.2fr] gap-2">
            <select className="input" aria-label="روز" value={date.d} onChange={(e) => setDate({ ...date, d: +e.target.value })}>
              {Array.from({ length: dim }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{toFaDigits(d)}</option>
              ))}
            </select>
            <select
              className="input"
              aria-label="ماه"
              value={date.m}
              onChange={(e) => {
                const m = +e.target.value;
                setDate({ ...date, m, d: Math.min(date.d, daysInMonth(date.y, m)) });
              }}
            >
              {MONTHS.map((n, i) => (
                <option key={n} value={i + 1}>{n}</option>
              ))}
            </select>
            <select
              className="input"
              aria-label="سال"
              value={date.y}
              onChange={(e) => {
                const y = +e.target.value;
                setDate({ ...date, y, d: Math.min(date.d, daysInMonth(y, date.m)) });
              }}
            >
              {years.map((y) => (
                <option key={y} value={y}>{toFaDigits(y)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="customer">مشتری</label>
          <div className="flex gap-2">
            <select id="customer" className="input min-w-0" value={customerId} onChange={(e) => setCustomerId(+e.target.value)}>
              <option value={0}>انتخاب کنید…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-soft !px-0 w-12 shrink-0"
              onClick={() => setNewCust(newCust ? null : { name: "", phone: "" })}
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
              <input className="input" placeholder="نام مشتری" aria-label="نام مشتری" autoFocus value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
              <input className="input num" inputMode="tel" placeholder="تلفن (اختیاری)" aria-label="تلفن مشتری" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
              {custError && <p className="text-danger text-sm" role="alert">{custError}</p>}
              <div className="flex gap-2">
                <button type="button" className="btn btn-primary flex-1" onClick={addCustomer} disabled={custPending}>
                  {custPending ? <IconSpinner size={20} /> : <IconCheck size={20} />}
                  ذخیره مشتری
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => { setNewCust(null); setCustError(""); }}>انصراف</button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="label" htmlFor="havale">شماره حواله</label>
            <input id="havale" className="input num" placeholder="اختیاری" value={havale} onChange={(e) => setHavale(e.target.value)} />
          </div>
          <div className="min-w-0">
            <span className="label">نوع پرداخت</span>
            <div className="seg" role="group" aria-label="نوع پرداخت">
              {["نقدی", "چکی"].map((p) => (
                <button key={p} type="button" aria-pressed={payment === p} onClick={() => setPayment(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ردیف‌های کالا */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="card-title">
            <IconYarn size={20} />
            اقلام فروش
          </h2>
          <span className="chip">{toFaDigits(rows.length)} ردیف</span>
        </div>
        {rows.map((r, idx) => {
          const prod = products.find((p) => p.id === r.productId);
          const cheles = prod?.cheles ?? [];
          const total = lineTotal(parseNum(r.weight), parseNum(r.fee));
          const pid = `p-${r.key}`;
          return (
            <div key={r.key} className="card space-y-3">
              <div className="flex items-center justify-between min-h-11 -my-1">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-600">
                  <span className="grid place-items-center min-w-7 h-7 px-1.5 rounded-lg bg-brand-soft text-brand text-xs">{toFaDigits(idx + 1)}</span>
                  {r.productName || "ردیف جدید"}
                </span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    aria-label={`حذف ردیف ${toFaDigits(idx + 1)}`}
                    title="حذف ردیف"
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  >
                    <IconTrash size={20} />
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <label className="label" htmlFor={`${pid}-prod`}>محصول</label>
                  <select id={`${pid}-prod`} className="input" value={r.productId ?? 0} onChange={(e) => pickProduct(r.key, +e.target.value)}>
                    <option value={0}>{r.productId === null && r.productName ? `${r.productName} (حذف‌شده)` : "انتخاب کنید…"}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="label" htmlFor={`${pid}-chele`}>نوع چله</label>
                  <select id={`${pid}-chele`} className="input" value={r.cheleName} onChange={(e) => setRow(r.key, { cheleName: e.target.value })} disabled={!prod && !r.cheleName}>
                    {!cheles.includes(r.cheleName) && <option value={r.cheleName}>{r.cheleName || "—"}</option>}
                    {cheles.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="label" htmlFor={`${pid}-w`}>وزن (کیلوگرم)</label>
                  <input id={`${pid}-w`} className="input num" inputMode="decimal" placeholder="0" value={r.weight} onChange={(e) => setRow(r.key, { weight: cleanDec(e.target.value) })} />
                </div>
                <div className="min-w-0">
                  <label className="label" htmlFor={`${pid}-f`}>فی (ریال)</label>
                  <input id={`${pid}-f`} className="input num" inputMode="numeric" placeholder="0" value={sep(cleanInt(r.fee))} onChange={(e) => setRow(r.key, { fee: cleanInt(e.target.value) })} />
                </div>
              </div>
              <div className="flex justify-between items-center gap-2 bg-slate-50 border border-line rounded-xl px-3 py-2.5">
                <span className="text-sm text-muted">قیمت کل ردیف</span>
                <b className="tabular-nums">
                  {fmtNum(total)} <span className="text-xs font-normal text-muted">ریال</span>
                </b>
              </div>
            </div>
          );
        })}
        <button
          type="button"
          className="btn w-full border-2 border-dashed !border-slate-300 text-brand bg-white/60 hover:bg-white"
          onClick={() => {
            setRows((rs) => [...rs, { key: nextKey, productId: null, productName: "", cheleName: "", weight: "", fee: "" }]);
            setNextKey((n) => n + 1);
          }}
        >
          <IconPlus size={20} />
          افزودن ردیف
        </button>
      </section>

      {/* هزینه و جمع */}
      <section className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="label" htmlFor="exp-title">عنوان هزینه</label>
            <input id="exp-title" className="input" value={expTitle} onChange={(e) => setExpTitle(e.target.value)} placeholder="مثلاً حمل" />
          </div>
          <div className="min-w-0">
            <label className="label" htmlFor="exp-amount">مبلغ هزینه (ریال)</label>
            <input id="exp-amount" className="input num" inputMode="numeric" placeholder="0" value={sep(cleanInt(expense))} onChange={(e) => setExpense(cleanInt(e.target.value))} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="note">توضیحات (اختیاری)</label>
          <input id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="روی فاکتور چاپ می‌شود" />
        </div>
        <dl className="rounded-xl bg-slate-50 border border-line p-3 space-y-1.5 text-[0.95rem]">
          <div className="flex justify-between gap-2"><dt className="text-muted">جمع کل صورت‌حساب</dt><dd className="tabular-nums">{fmtNum(subtotal)} ریال</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-muted truncate">{expTitle || "هزینه"}</dt><dd className="tabular-nums">{fmtNum(exp)} ریال</dd></div>
          <div className="flex justify-between gap-2 text-lg font-bold border-t border-line pt-2 mt-1"><dt>مانده حساب</dt><dd className="tabular-nums">{fmtNum(balance)} ریال</dd></div>
        </dl>
      </section>

      {error && (
        <p className="alert alert-error" role="alert">{error}</p>
      )}

      {/* نوار ثابت ذخیره: بالای منوی پایین و ناحیه امن */}
      <div className="action-bar">
        <div className="flex items-center gap-3 rounded-2xl bg-white/95 backdrop-blur border border-line shadow-[0_10px_30px_-10px_rgba(15,23,42,0.35)] p-2 pr-4">
          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-[0.7rem] text-muted">مانده حساب</div>
            <div className="font-bold tabular-nums truncate">
              {fmtNum(balance)} <span className="text-xs font-normal text-muted">ریال</span>
            </div>
          </div>
          <button className="btn btn-primary shrink-0 !px-5" disabled={pending} onClick={submit}>
            {pending ? <IconSpinner size={20} /> : <IconCheck size={20} />}
            {pending ? "در حال ذخیره..." : initial ? "ذخیره" : "ثبت فاکتور"}
          </button>
        </div>
      </div>
    </div>
  );
}

