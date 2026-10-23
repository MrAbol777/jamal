import { Prisma } from "@prisma/client";
import { db } from "./db";
import { lineTotal } from "./format";
import { fromJ, jYearOf, type J } from "./jalali";

export type ItemInput = {
  productId: number | null;
  productName: string;
  cheleName: string;
  weight: number;
  fee: number;
};

export type InvoiceInput = {
  date: J;
  havaleNo: string;
  customerId: number;
  paymentType: string;
  expenseTitle: string;
  expenseAmount: number;
  note: string;
  items: ItemInput[];
};

export function calcTotals(items: { weight: number; fee: number }[], expense: number) {
  const subtotal = items.reduce((s, i) => s + lineTotal(i.weight, i.fee), 0);
  return { subtotal, expense, balance: subtotal + expense };
}

export function validate(input: InvoiceInput): string | null {
  if (!fromJ(input.date)) return "تاریخ نامعتبر است";
  if (!input.customerId) return "مشتری را انتخاب کنید";
  if (input.items.length === 0) return "حداقل یک ردیف کالا لازم است";
  for (const [i, it] of input.items.entries()) {
    if (!it.productName) return `ردیف ${i + 1}: محصول را انتخاب کنید`;
    if (!(it.weight > 0)) return `ردیف ${i + 1}: وزن را وارد کنید`;
    if (!(it.fee >= 0)) return `ردیف ${i + 1}: فی نامعتبر است`;
  }
  return null;
}

const itemData = (items: ItemInput[]) =>
  items.map((i) => ({
    productId: i.productId,
    productName: i.productName,
    cheleName: i.cheleName,
    weight: i.weight,
    fee: i.fee,
  }));

export async function createInvoice(input: InvoiceInput): Promise<number> {
  const date = fromJ(input.date)!;
  const year = jYearOf(date);
  return db.$transaction(async (tx) => {
    // شماره فاکتور هر سال از ۱ شروع می‌شود و شماره حذف‌شده دوباره استفاده نمی‌شود
    const counter = await tx.invoiceCounter.upsert({
      where: { year },
      update: { last: { increment: 1 } },
      create: { year, last: 1 },
    });
    const inv = await tx.invoice.create({
      data: {
        year,
        number: counter.last,
        date,
        havaleNo: input.havaleNo,
        customerId: input.customerId,
        paymentType: input.paymentType,
        expenseTitle: input.expenseTitle || "هزینه",
        expenseAmount: input.expenseAmount,
        note: input.note,
        items: { create: itemData(input.items) },
      },
    });
    return inv.id;
  });
}

export async function updateInvoice(id: number, input: InvoiceInput) {
  const date = fromJ(input.date)!;
  await db.$transaction([
    db.invoiceItem.deleteMany({ where: { invoiceId: id } }),
    db.invoice.update({
      where: { id },
      data: {
        // سال/شماره فاکتور ثابت می‌ماند؛ فقط تاریخ نمایشی تغییر می‌کند
        date,
        havaleNo: input.havaleNo,
        customerId: input.customerId,
        paymentType: input.paymentType,
        expenseTitle: input.expenseTitle || "هزینه",
        expenseAmount: input.expenseAmount,
        note: input.note,
        items: { create: itemData(input.items) },
      },
    }),
  ]);
}

export type FullInvoice = Prisma.InvoiceGetPayload<{ include: { items: true; customer: true } }>;

export async function getInvoice(id: number): Promise<FullInvoice | null> {
  return db.invoice.findUnique({
    where: { id },
    include: { items: { orderBy: { id: "asc" } }, customer: true },
  });
}
