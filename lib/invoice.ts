import { Prisma } from "@prisma/client";
import { db } from "./db";
import { lineTotal } from "./format";
import { fromJ, jYearOf, type J } from "./jalali";

/** هر ردیف صورتحساب: تاریخ و شماره حواله خودش را دارد؛ نام محصول می‌تواند متن دلخواه باشد */
export type ItemInput = {
  date: J;
  havaleNo: string;
  productId: number | null;
  productName: string;
  weight: number | null;
  fee: number | null;
  /** فقط وقتی وزن یا فی خالی است استفاده می‌شود (مثلاً «مانده از قبل») */
  amount: number;
};

export type HeaderInput = { date: J; expenseTitle: string; expenseAmount: number };

/** مبلغ ردیف: وزن×فی اگر هر دو باشند، وگرنه مبلغ دستی */
export function itemAmount(i: { weight: number | null; fee: number | null; amount: number }): number {
  if (i.weight && i.fee) return lineTotal(i.weight, i.fee);
  return Math.round(i.amount || 0);
}

export function calcTotals(items: { amount: number }[], expense: number) {
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  return { subtotal, expense, balance: subtotal + expense };
}

export function validateHeader(h: HeaderInput): string | null {
  if (!fromJ(h.date)) return "تاریخ نامعتبر است";
  if (!Number.isFinite(h.expenseAmount)) return "مبلغ هزینه نامعتبر است";
  return null;
}

export function validateItem(i: ItemInput): string | null {
  if (!fromJ(i.date)) return "تاریخ نامعتبر است";
  if (!i.productName.trim()) return "محصول را انتخاب کنید یا بنویسید";
  if (i.weight !== null && !(i.weight >= 0)) return "وزن نامعتبر است";
  if (i.fee !== null && !(i.fee >= 0)) return "فی نامعتبر است";
  if (!itemAmount(i) && !(i.weight && i.fee)) return "وزن و فی، یا مبلغ کل را وارد کنید";
  return null;
}

export async function createStatement(customerId: number, dateJ: J): Promise<number> {
  const date = fromJ(dateJ)!;
  const year = jYearOf(date);
  return db.$transaction(async (tx) => {
    // شماره صورتحساب هر سال از ۱ شروع می‌شود و شماره حذف‌شده دوباره استفاده نمی‌شود
    const counter = await tx.invoiceCounter.upsert({
      where: { year },
      update: { last: { increment: 1 } },
      create: { year, last: 1 },
    });
    const inv = await tx.invoice.create({ data: { year, number: counter.last, date, customerId } });
    return inv.id;
  });
}

export async function updateHeader(id: number, h: HeaderInput) {
  await db.invoice.update({
    where: { id },
    data: { date: fromJ(h.date)!, expenseTitle: h.expenseTitle.trim() || "هزینه", expenseAmount: h.expenseAmount },
  });
}

const itemData = (i: ItemInput) => ({
  date: fromJ(i.date)!,
  havaleNo: i.havaleNo.trim(),
  productId: i.productId,
  productName: i.productName.trim(),
  weight: i.weight || null,
  fee: i.fee || null,
  amount: itemAmount(i),
});

export async function addItem(invoiceId: number, i: ItemInput) {
  await db.invoiceItem.create({ data: { invoiceId, ...itemData(i) } });
}

export async function updateItem(itemId: number, i: ItemInput) {
  await db.invoiceItem.update({ where: { id: itemId }, data: itemData(i) });
}

export type FullInvoice = Prisma.InvoiceGetPayload<{ include: { items: true; customer: true } }>;

export async function getInvoice(id: number): Promise<FullInvoice | null> {
  return db.invoice.findUnique({
    where: { id },
    // ترتیب چاپ: به‌ترتیب تاریخ فروش، و در یک روز به‌ترتیب ثبت
    include: { items: { orderBy: [{ date: "asc" }, { id: "asc" }] }, customer: true },
  });
}
