"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveHeader } from "@/app/actions";
import { cleanInt, groupDigits, parseNum } from "@/lib/format";
import type { J } from "@/lib/jalali";
import { DateFields } from "@/components/date-fields";
import { IconCheck, IconSpinner } from "@/components/icons";

export function HeaderForm({
  id,
  baseYear,
  initial,
}: {
  id: number;
  baseYear: number;
  initial: { date: J; expenseTitle: string; expenseAmount: number };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [date, setDate] = useState<J>(initial.date);
  const [title, setTitle] = useState(initial.expenseTitle);
  const [amount, setAmount] = useState(initial.expenseAmount ? String(Math.round(initial.expenseAmount)) : "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    start(async () => {
      try {
        const r = await saveHeader(id, { date, expenseTitle: title, expenseAmount: parseNum(amount) });
        if (r.error) return setError(r.error);
      } catch {
        return setError("ذخیره انجام نشد؛ دوباره تلاش کنید");
      }
      router.replace(`/invoices/${id}`);
    });
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <DateFields label="تاریخ فاکتور" value={date} onChange={setDate} baseYear={baseYear} />
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className="label" htmlFor="exp-title">عنوان هزینه</label>
          <input id="exp-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="هزینه" />
        </div>
        <div className="min-w-0">
          <label className="label" htmlFor="exp-amount">مبلغ هزینه (ریال)</label>
          <input
            id="exp-amount"
            className="input num"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={groupDigits(amount)}
            onChange={(e) => setAmount(cleanInt(e.target.value))}
          />
        </div>
      </div>
      <p className="help !mt-0">هزینه به جمع ردیف‌ها اضافه می‌شود و «مانده حساب» را می‌سازد. اگر هزینه‌ای نیست خالی بگذارید.</p>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1" disabled={pending}>
          {pending ? <IconSpinner size={20} /> : <IconCheck size={20} />}
          ذخیره
        </button>
        <Link href={`/invoices/${id}`} className="btn btn-ghost">انصراف</Link>
      </div>
    </form>
  );
}
