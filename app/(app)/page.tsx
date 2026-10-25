import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { calcTotals } from "@/lib/invoice";
import { fmtInvoiceNo, fmtRial, toEnDigits, toFaDigits } from "@/lib/format";
import { fmtJ } from "@/lib/jalali";
import { IconCalendar, IconChevron, IconInvoice, IconPlus, IconSearch } from "@/components/icons";

export const dynamic = "force-dynamic";

/** شرط جستجو: نام مشتری، شماره صورتحساب (مثلاً ۱۴۰۵۰۰۰۱ یا فقط ۱) یا شماره حواله یکی از ردیف‌ها */
function searchWhere(rawQ: string): Prisma.InvoiceWhereInput | undefined {
  if (!rawQ) return undefined;
  const q = toEnDigits(rawQ).trim();
  const or: Prisma.InvoiceWhereInput[] = [{ customer: { name: { contains: rawQ, mode: "insensitive" } } }];
  if (/^\d+$/.test(q)) {
    if (q.length > 4) or.push({ year: Number(q.slice(0, 4)), number: Number(q.slice(4)) });
    else or.push({ number: Number(q) });
    or.push({ items: { some: { havaleNo: q } } });
  }
  return { OR: or };
}

export default async function StatementsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const rawQ = ((await searchParams).q ?? "").trim();
  const invoices = await db.invoice.findMany({
    where: searchWhere(rawQ),
    select: {
      id: true,
      year: true,
      number: true,
      date: true,
      expenseAmount: true,
      customer: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: 100,
  });
  // جمع ردیف‌ها در پایگاه داده حساب می‌شود تا ردیف‌ها بارگذاری نشوند
  const sums = invoices.length
    ? await db.invoiceItem.groupBy({ by: ["invoiceId"], where: { invoiceId: { in: invoices.map((i) => i.id) } }, _sum: { amount: true } })
    : [];
  const sumOf = new Map(sums.map((s) => [s.invoiceId, s._sum.amount ?? 0]));

  return (
    <div className="space-y-4">
      <div className="page-head">
        <div className="flex-1 min-w-0">
          <h1 className="page-title">صورتحساب‌ها</h1>
          {invoices.length > 0 && (
            <p className="page-sub">{rawQ ? `${toFaDigits(invoices.length)} نتیجه` : `${toFaDigits(invoices.length)} صورتحساب`}</p>
          )}
        </div>
        <Link href="/invoices/new" className="btn btn-primary !px-4">
          <IconPlus size={20} />
          صورتحساب جدید
        </Link>
      </div>

      <form className="relative" role="search">
        <IconSearch size={20} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          name="q"
          type="search"
          defaultValue={rawQ}
          placeholder="نام مشتری یا شماره"
          aria-label="جستجو در صورتحساب‌ها"
          className="input !pr-11 !pl-24"
          enterKeyHint="search"
        />
        <button className="btn btn-soft absolute left-0.5 top-0.5 !min-h-11 !py-1 !px-4 text-sm">جستجو</button>
      </form>
      {rawQ && (
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-accent min-h-11">
          پاک کردن جستجو
        </Link>
      )}

      {invoices.length === 0 ? (
        <div className="card empty">
          <span className="empty-icon">{rawQ ? <IconSearch size={30} /> : <IconInvoice size={30} />}</span>
          <b className="text-fg">{rawQ ? "صورتحسابی پیدا نشد" : "هنوز صورتحسابی ساخته نشده"}</b>
          <p className="text-sm">{rawQ ? "عبارت دیگری را امتحان کنید." : "برای هر مشتری یک صورتحساب بسازید و فروش‌ها را ردیف‌به‌ردیف به آن اضافه کنید."}</p>
          {!rawQ && (
            <Link href="/invoices/new" className="btn btn-primary mt-2">
              <IconPlus size={20} />
              صورتحساب جدید
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {invoices.map((inv) => {
            const t = calcTotals([{ amount: sumOf.get(inv.id) ?? 0 }], inv.expenseAmount);
            return (
              <li key={inv.id}>
                <Link href={`/invoices/${inv.id}`} className="card list-card flex items-center gap-3 !p-4">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <b className="block truncate text-[1.05rem]">{inv.customer.name}</b>
                    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[0.8rem] text-muted">
                      <span className="font-bold text-slate-600 tabular-nums">{fmtInvoiceNo(inv.year, inv.number)}</span>
                      <span className="flex items-center gap-1">
                        <IconCalendar size={15} />
                        {fmtJ(inv.date)}
                      </span>
                      <span className="chip">{toFaDigits(inv._count.items)} ردیف</span>
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
