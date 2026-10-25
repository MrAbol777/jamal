"use client";

import { useId } from "react";
import { toFaDigits } from "@/lib/format";
import { MONTHS, daysInMonth, type J } from "@/lib/jalali";

/** انتخاب تاریخ شمسی با سه فهرست روز / ماه / سال (مناسب لمس) */
export function DateFields({
  value,
  onChange,
  label,
  baseYear,
  id,
}: {
  value: J;
  onChange: (j: J) => void;
  label: string;
  /** سال مرکز بازه (پیش‌فرض: سال همین تاریخ) — بازه ±۳ سال */
  baseYear?: number;
  /** شناسه فهرست «روز» برای فوکوس از بیرون */
  id?: string;
}) {
  const auto = useId();
  const dayId = id ?? `${auto}-d`;
  const labelId = `${auto}-l`;
  const center = baseYear ?? value.y;
  const years = Array.from({ length: 7 }, (_, i) => center - 3 + i);
  if (!years.includes(value.y)) {
    years.push(value.y);
    years.sort((a, b) => a - b);
  }
  const dim = daysInMonth(value.y, value.m);

  return (
    <div role="group" aria-labelledby={labelId}>
      <span className="label" id={labelId}>{label}</span>
      <div className="grid grid-cols-[1fr_1.45fr_1.25fr] gap-2">
        <select id={dayId} className="input" aria-label="روز" value={value.d} onChange={(e) => onChange({ ...value, d: +e.target.value })}>
          {Array.from({ length: dim }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>{toFaDigits(d)}</option>
          ))}
        </select>
        <select
          className="input"
          aria-label="ماه"
          value={value.m}
          onChange={(e) => {
            const m = +e.target.value;
            onChange({ ...value, m, d: Math.min(value.d, daysInMonth(value.y, m)) });
          }}
        >
          {MONTHS.map((n, i) => (
            <option key={n} value={i + 1}>{n}</option>
          ))}
        </select>
        <select
          className="input"
          aria-label="سال"
          value={value.y}
          onChange={(e) => {
            const y = +e.target.value;
            onChange({ ...value, y, d: Math.min(value.d, daysInMonth(y, value.m)) });
          }}
        >
          {years.map((y) => (
            <option key={y} value={y}>{toFaDigits(y)}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
