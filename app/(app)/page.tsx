import Link from "next/link";
import { db } from "@/lib/db";
import { calcTotals } from "@/lib/invoice";
import { fmtInvoiceNo, fmtRial, toEnDigits, toFaDigits } from "@/lib/format";
import { fmtJ } from "@/lib/jalali";
import { IconCalendar, IconChevron, IconInvoice, IconPlus, IconSearch } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const rawQ = ((await searchParams).q ?? "").trim();
  const q = toEnDigits(rawQ).trim();
  const asNum = /^\d+$/.test(q) ? Number(q) : null;
  const invoices = await db.invoice.findMany({
    where: q
      ? {
          OR: [
            { customer: { name: { contains: rawQ } } },
            { customer: { name: { contains: q } } },
            { havaleNo: { contains: q } },
            ...(asNum !== null ? [{ number: asNum }] : []),
          ],
        }
      : undefined,
    include: { customer: true, items: true },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="page-head">
        <div className="flex-1 min-w-0">
          <h1 className="page-title">فاکتورهای فروش</h1>
          {invoices.length > 0 && <p className="page-sub">{q ? `${toFaDigits(invoices.length)} نتیجه` : `${toFaDigits(invoices.length)} فاکتور اخیر`}</p>}
        </div>
        <Link href="/invoices/new" className="btn btn-primary !px-4">
          <IconPlus size={20} />
          فاکتور جدید
        </Link>
      </div>

      <form className="relative" role="search">
        <IconSearch size={20} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          name="q"
          type="search"
          defaultValue={rawQ}
          placeholder="مشتری، شماره فاکتور یا حواله"
          aria-label="جستجو"
          className="input !pr-11 !pl-24"
          enterKeyHint="search"
        />
        <button className="btn btn-soft absolute left-0.5 top-0.5 !min-h-11 !py-1 !px-4 text-sm">جستجو</button>
      </form>
      {q && (
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-accent min-h-11">
          پاک کردن جستجو
        </Link>
      )}

      {invoices.length === 0 ? (
        <div className="card empty">
          <span className="empty-icon">{q ? <IconSearch size={30} /> : <IconInvoice size={30} />}</span>
          <b className="text-fg">{q ? "فاکتوری پیدا نشد" : "هنوز فاکتوری ثبت نشده"}</b>
          <p className="text-sm">{q ? "عبارت دیگری را امتحان کنید." : "برای شروع، اولین فاکتور فروش را ثبت کنید."}</p>
          {!q && (
            <Link href="/invoices/new" className="btn btn-primary mt-2">
              <IconPlus size={20} />
              فاکتور جدید
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {invoices.map((inv) => {
            const t = calcTotals(inv.items, inv.expenseAmount);
            return (
              <li key={inv.id}>
                <Link href={`/invoices/${inv.id}`} className="card list-card flex items-center gap-3 !p-4">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <b className="truncate text-[1.05rem]">{inv.customer.name}</b>
                      <span className={`chip mr-auto ${inv.paymentType === "چکی" ? "!bg-amber-50 !text-amber-800" : "!bg-emerald-50 !text-emerald-800"}`}>
                        {inv.paymentType}
                      </span>
                    </div>
                    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[0.8rem] text-muted">
                      <span className="font-bold text-slate-600 tabular-nums">{fmtInvoiceNo(inv.year, inv.number)}</span>
                      <span className="flex items-center gap-1">
                        <IconCalendar size={15} />
                        {fmtJ(inv.date)}
                      </span>
                      <span>{toFaDigits(inv.items.length)} قلم</span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2 pt-1.5 border-t border-dashed border-line">
                      <span className="text-[0.8rem] text-muted">مانده حساب</span>
                      <span className="font-bold text-lg text-fg tabular-nums">
                        {fmtRial(t.balance)} <span className="text-xs font-normal text-muted">ریال</span>
                      </span>
                    </div>
                  </div>
                  <IconChevron size={20} className="text-slate-300 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
