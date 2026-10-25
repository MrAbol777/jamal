"use client";

import { useEffect, useId, useRef, useState } from "react";
import { saveItem } from "@/app/actions";
import { cleanDec, cleanInt, fmtNum, groupDigits, lineTotal, parseNum } from "@/lib/format";
import type { J } from "@/lib/jalali";
import { DateFields } from "@/components/date-fields";
import { IconCheck, IconClose, IconPlus, IconSpinner } from "@/components/icons";
import type { RowData } from "./rows";

export type ProductOpt = { id: number; name: string; price: number };

const CUSTOM = "custom";

/** کلید انتخاب محصول: شناسه محصول، «custom» برای متن دلخواه، یا خالی */
function initialSel(row: RowData | null): string {
  if (!row) return "";
  if (row.productId === null) return CUSTOM;
  return String(row.productId);
}

/** فقط ارقام فارسی/عربی را لاتین می‌کند؛ هیچ نویسه دیگری حذف نمی‌شود (شماره حواله متن آزاد است) */
const latinDigits = (s: string) =>
  s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

const numStr =(n: number | null | undefined) => (n ? String(n) : "");

/** فاصله کیبورد مجازی از پایین صفحه (برای اینکه برگه زیر کیبورد نرود) */
function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

export function RowSheet({
  invoiceId,
  row,
  products,
  defaultDate,
  baseYear,
  onDateUsed,
  onClose,
}: {
  invoiceId: number;
  row: RowData | null;
  products: ProductOpt[];
  defaultDate: J;
  baseYear: number;
  onDateUsed: (j: J) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const isNew = !row;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(0);
  const [which, setWhich] = useState<"save" | "next">("save");

  // محصولی که بعداً غیرفعال شده هم در فهرست بماند
  const [options] = useState<ProductOpt[]>(() =>
    row?.productId && !products.some((p) => p.id === row.productId)
      ? [{ id: row.productId, name: row.productName, price: 0 }, ...products]
      : products,
  );

  const [date, setDate] = useState<J>(row?.date ?? defaultDate);
  const [havale, setHavale] = useState(row?.havaleNo ?? "");
  const [sel, setSel] = useState(() => initialSel(row));
  const [customName, setCustomName] = useState(row && row.productId === null ? row.productName : "");
  const [weight, setWeight] = useState(numStr(row?.weight));
  const [fee, setFee] = useState(row?.fee ? String(Math.round(row.fee)) : "");
  const [amount, setAmount] = useState(row && !(row.weight && row.fee) ? String(Math.round(row.amount)) : "");

  const havaleRef = useRef<HTMLInputElement>(null);
  const customRef = useRef<HTMLInputElement>(null);
  const inset = useKeyboardInset();

  const w = parseNum(weight);
  const f = parseNum(fee);
  const computed = w > 0 && f > 0 ? lineTotal(w, f) : null;

  // فوکوس اولین فیلد، قفل اسکرول صفحه، بستن با Escape
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    document.getElementById(`${uid}-date`)?.focus({ preventScroll: true });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [uid]);

  function pickProduct(v: string) {
    setSel(v);
    if (v === CUSTOM) {
      requestAnimationFrame(() => customRef.current?.focus());
      return;
    }
    const p = options.find((x) => String(x.id) === v);
    if (p && p.price > 0) setFee(String(Math.round(p.price)));
  }

  async function submit(next: boolean) {
    if (pending) return;
    setError("");
    setWhich(next ? "next" : "save");
    const product = sel && sel !== CUSTOM ? options.find((p) => String(p.id) === sel) : undefined;
    const productName = sel === CUSTOM ? customName : product?.name ?? "";
    setPending(true);
    try {
      // اکشن با revalidatePath همین صفحه را تازه می‌کند؛ router.refresh جداگانه لازم نیست
      const r = await saveItem(invoiceId, row?.id ?? null, {
        date,
        havaleNo: havale,
        productId: product?.id ?? null,
        productName,
        weight: weight ? w : null,
        fee: fee ? f : null,
        amount: computed ?? parseNum(amount),
      });
      if (r.error) return setError(r.error);
    } catch {
      return setError("ذخیره انجام نشد؛ اتصال اینترنت را بررسی کنید و دوباره بزنید");
    } finally {
      setPending(false);
    }
    if (isNew) onDateUsed(date);
    if (next) {
      setHavale("");
      setWeight("");
      setAmount("");
      setSaved((n) => n + 1);
      requestAnimationFrame(() => havaleRef.current?.focus());
    } else {
      onClose();
    }
  }

  const titleId = `${uid}-title`;

  return (
    <div className="sheet-overlay" style={inset ? { bottom: inset } : undefined} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-line">
          <span className="sheet-grip md:hidden" aria-hidden="true" />
          <h2 id={titleId} className="flex-1 font-bold text-[1.05rem]">
            {isNew ? "ردیف جدید" : `ویرایش ردیف ${fmtNum(row.no)}`}
          </h2>
          <button type="button" className="icon-btn !border-transparent" aria-label="بستن" title="بستن" onClick={onClose}>
            <IconClose size={22} />
          </button>
        </div>

        <form
          className="flex-1 min-h-0 flex flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
        >
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
            <DateFields id={`${uid}-date`} label="تاریخ" value={date} onChange={setDate} baseYear={baseYear} />

            <div>
              <label className="label" htmlFor={`${uid}-havale`}>شماره حواله</label>
              <input
                id={`${uid}-havale`}
                ref={havaleRef}
                className="input num"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="next"
                placeholder="اختیاری"
                value={havale}
                onChange={(e) => setHavale(latinDigits(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    document.getElementById(`${uid}-prod`)?.focus();
                  }
                }}
              />
            </div>

            <div>
              <label className="label" htmlFor={`${uid}-prod`}>نوع چله / محصول</label>
              <select id={`${uid}-prod`} className="input" value={sel} onChange={(e) => pickProduct(e.target.value)}>
                <option value="">انتخاب کنید…</option>
                {options.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
                <option value={CUSTOM}>متن دلخواه…</option>
              </select>
              {sel === CUSTOM && (
                <input
                  ref={customRef}
                  className="input mt-2"
                  aria-label="متن دلخواه برای نوع چله"
                  placeholder="مثلاً مانده از قبل، طراحی"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="label" htmlFor={`${uid}-w`}>وزن (کیلوگرم)</label>
                <input
                  id={`${uid}-w`}
                  className="input num"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={weight}
                  onChange={(e) => setWeight(cleanDec(e.target.value))}
                />
              </div>
              <div className="min-w-0">
                <label className="label" htmlFor={`${uid}-f`}>فی (ریال)</label>
                <input
                  id={`${uid}-f`}
                  className="input num"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  value={groupDigits(fee)}
                  onChange={(e) => setFee(cleanInt(e.target.value))}
                />
              </div>
            </div>

            {computed !== null ? (
              <div className="flex justify-between items-center gap-2 bg-slate-50 border border-line rounded-xl px-3 min-h-12" aria-live="polite">
                <span className="text-sm text-muted">مبلغ کل (وزن × فی)</span>
                <b className="tabular-nums">
                  {fmtNum(computed)} <span className="text-xs font-normal text-muted">ریال</span>
                </b>
              </div>
            ) : (
              <div>
                <label className="label" htmlFor={`${uid}-amt`}>مبلغ کل (ریال)</label>
                <input
                  id={`${uid}-amt`}
                  className="input num"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  value={groupDigits(amount)}
                  onChange={(e) => setAmount(cleanInt(e.target.value))}
                />
                <p className="help">برای ردیف‌هایی مثل «مانده از قبل» یا «طراحی» که وزن و فی ندارند.</p>
              </div>
            )}

            {error && <p className="alert alert-error" role="alert">{error}</p>}
            {saved > 0 && !error && (
              <p className="alert alert-ok" role="status">
                <IconCheck size={18} className="shrink-0 mt-0.5" />
                {saved === 1 ? "ردیف ذخیره شد؛ ردیف بعدی را وارد کنید." : `${fmtNum(saved)} ردیف ذخیره شد؛ ردیف بعدی را وارد کنید.`}
              </p>
            )}
          </div>

          <div className="sheet-foot">
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" disabled={pending}>
                {pending && which === "save" ? <IconSpinner size={20} /> : <IconCheck size={20} />}
                ذخیره
              </button>
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={pending}>
                انصراف
              </button>
            </div>
            {isNew && (
              <button type="button" className="btn btn-soft w-full" disabled={pending} onClick={() => submit(true)}>
                {pending && which === "next" ? <IconSpinner size={20} /> : <IconPlus size={20} />}
                ذخیره و ردیف بعدی
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
