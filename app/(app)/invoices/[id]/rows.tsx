"use client";

import { useState, useTransition } from "react";
import { deleteItem } from "@/app/actions";
import { fmtNum, fmtRial, fmtWeight, toFaDigits } from "@/lib/format";
import type { J } from "@/lib/jalali";
import { IconCalendar, IconPencil, IconPlus, IconSpinner, IconTrash, IconYarn } from "@/components/icons";
import { RowSheet, type ProductOpt } from "./row-sheet";

export type RowData = {
  id: number;
  /** شماره ردیف در ترتیب چاپ */
  no: number;
  date: J;
  dateStr: string;
  havaleNo: string;
  productId: number | null;
  productName: string;
  weight: number | null;
  fee: number | null;
  amount: number;
};

export function StatementRows({ invoiceId, rows, products, today }: { invoiceId: number; rows: RowData[]; products: ProductOpt[]; today: J }) {
  const [editor, setEditor] = useState<{ row: RowData | null; key: number } | null>(null);
  const [lastDate, setLastDate] = useState<J>(today);
  const [removing, setRemoving] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [, start] = useTransition();

  function remove(r: RowData) {
    if (!confirm(`ردیف ${toFaDigits(r.no)} (${r.productName}) حذف شود؟`)) return;
    setRemoving(r.id);
    setError("");
    start(async () => {
      try {
        // اکشن با revalidatePath همین صفحه را تازه می‌کند
        await deleteItem(r.id);
      } catch {
        setError("حذف ردیف انجام نشد؛ دوباره تلاش کنید");
      } finally {
        setRemoving(null);
      }
    });
  }

  const open = (row: RowData | null) => setEditor((e) => ({ row, key: (e?.key ?? 0) + 1 }));

  return (
    <section className="space-y-3" aria-labelledby="rows-title">
      <div className="flex items-center justify-between px-1">
        <h2 className="card-title" id="rows-title">
          <IconYarn size={20} />
          ردیف‌های فروش
        </h2>
        <span className="chip">{toFaDigits(rows.length)} ردیف</span>
      </div>

      {error && <p className="alert alert-error" role="alert">{error}</p>}

      {rows.length === 0 ? (
        <div className="card empty">
          <span className="empty-icon"><IconYarn size={30} /></span>
          <b className="text-fg">هنوز ردیفی ثبت نشده</b>
          <p className="text-sm">هر فروش (یا مانده از قبل) را با دکمه «افزودن ردیف» اضافه کنید.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="card row-card !p-3 flex items-start gap-3">
              <span className="grid place-items-center min-w-8 h-8 px-1.5 mt-0.5 rounded-lg bg-brand-soft text-brand text-xs font-bold tabular-nums shrink-0" title="شماره ردیف در چاپ">
                {toFaDigits(r.no)}
              </span>
              <div className="flex-1 min-w-0">
                <b className="block truncate">{r.productName}</b>
                <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-[0.8rem] text-muted">
                  <span className="flex items-center gap-1">
                    <IconCalendar size={14} />
                    {r.dateStr}
                  </span>
                  {r.havaleNo && <span>حواله <span className="tabular-nums text-slate-600">{toFaDigits(r.havaleNo)}</span></span>}
                </div>
                <div className="flex items-baseline justify-between gap-2 mt-1 flex-wrap">
                  <span className="text-[0.8rem] text-muted tabular-nums">
                    {r.weight && r.fee ? `${fmtWeight(r.weight)} کیلو × ${fmtNum(r.fee)}` : r.weight ? `${fmtWeight(r.weight)} کیلو` : ""}
                  </span>
                  <span className="font-bold tabular-nums mr-auto">
                    {fmtRial(r.amount)} <span className="text-xs font-normal text-muted">ریال</span>
                  </span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <button type="button" className="icon-btn" aria-label={`ویرایش ردیف ${toFaDigits(r.no)}`} title="ویرایش" onClick={() => open(r)}>
                  <IconPencil size={20} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  aria-label={`حذف ردیف ${toFaDigits(r.no)}`}
                  title="حذف"
                  disabled={removing !== null}
                  onClick={() => remove(r)}
                >
                  {removing === r.id ? <IconSpinner size={20} /> : <IconTrash size={20} />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="action-bar">
        <button type="button" className="btn btn-primary w-full shadow-[0_10px_30px_-10px_rgba(15,23,42,0.45)]" onClick={() => open(null)}>
          <IconPlus size={22} />
          افزودن ردیف
        </button>
      </div>

      {editor && (
        <RowSheet
          key={editor.key}
          invoiceId={invoiceId}
          row={editor.row}
          products={products}
          defaultDate={lastDate}
          baseYear={today.y}
          onDateUsed={setLastDate}
          onClose={() => setEditor(null)}
        />
      )}
    </section>
  );
}
