import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";

/** نسخه پشتیبان کامل داده‌ها (بدون رمزها). همان فایلی که از «تنظیمات» دانلود می‌شود. */
export async function exportBackup(client: PrismaClient | Prisma.TransactionClient = db) {
  const [setting, products, customers, invoiceCounters, invoices] = await Promise.all([
    client.setting.findUnique({ where: { id: 1 } }),
    client.product.findMany({ orderBy: { id: "asc" } }),
    client.customer.findMany({ orderBy: { id: "asc" } }),
    client.invoiceCounter.findMany({ orderBy: { year: "asc" } }),
    client.invoice.findMany({ orderBy: { id: "asc" }, include: { items: { orderBy: { id: "asc" } } } }),
  ]);
  return { version: 2, exportedAt: new Date().toISOString(), setting, products, customers, invoiceCounters, invoices };
}

export type BackupCounts = { products: number; customers: number; invoices: number; items: number };

type Obj = Record<string, unknown>;
const bad = (what: string): never => {
  throw new Error(`فایل پشتیبان نامعتبر است (${what})`);
};
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown, what: string): Obj[] => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || !v.every(isObj)) return bad(what);
  return v as Obj[];
};
const int = (v: unknown, what: string): number => (Number.isInteger(v) ? (v as number) : bad(what));
const num = (v: unknown, what: string): number => (typeof v === "number" && Number.isFinite(v) ? v : bad(what));
const numOrNull = (v: unknown, what: string): number | null => (v === null || v === undefined ? null : num(v, what));
const str = (v: unknown, what: string): string => (typeof v === "string" ? v : bad(what));
const strOr = (v: unknown, d = ""): string => (typeof v === "string" ? v : d);
const date = (v: unknown, what: string): Date => {
  const d = new Date(typeof v === "string" ? v : NaN);
  return Number.isNaN(d.getTime()) ? bad(what) : d;
};

const SEQUENCES: [string, string][] = [
  ["Product", "id"],
  ["Customer", "id"],
  ["Invoice", "id"],
  ["InvoiceItem", "id"],
];

/**
 * بازگردانی نسخه پشتیبان در یک تراکنش. فقط وقتی کار می‌کند که مشتری، محصول و صورتحساب‌ها خالی باشند
 * تا اشتباهاً چیزی رونویسی نشود (اگر خطایی رخ دهد کل تراکنش برمی‌گردد).
 */
export async function importBackup(tx: Prisma.TransactionClient, raw: unknown, opts: { requireEmpty?: boolean } = {}): Promise<BackupCounts> {
  if (!isObj(raw)) bad("ساختار");
  const data = raw as Obj;

  if (opts.requireEmpty !== false) {
    const [p, c, i] = await Promise.all([tx.product.count(), tx.customer.count(), tx.invoice.count()]);
    if (p + c + i > 0) throw new Error("دیتابیس خالی نیست؛ بازگردانی فقط روی سیستم تازه و خالی انجام می‌شود");
  }

  const products = arr(data.products, "محصولات").map((p) => ({
    id: int(p.id, "شناسه محصول"),
    name: str(p.name, "نام محصول"),
    price: num(p.price ?? 0, "قیمت محصول"),
    active: p.active === false ? false : true,
    createdAt: p.createdAt ? date(p.createdAt, "تاریخ محصول") : new Date(),
  }));
  const customers = arr(data.customers, "مشتری‌ها").map((c) => ({
    id: int(c.id, "شناسه مشتری"),
    name: str(c.name, "نام مشتری"),
    phone: strOr(c.phone),
    address: strOr(c.address),
  }));
  const invoicesRaw = arr(data.invoices, "صورتحساب‌ها");
  const invoices = invoicesRaw.map((i) => ({
    id: int(i.id, "شناسه صورتحساب"),
    year: int(i.year, "سال صورتحساب"),
    number: int(i.number, "شماره صورتحساب"),
    date: date(i.date, "تاریخ صورتحساب"),
    customerId: int(i.customerId, "مشتری صورتحساب"),
    expenseTitle: strOr(i.expenseTitle, "هزینه"),
    expenseAmount: num(i.expenseAmount ?? 0, "مبلغ هزینه"),
    createdAt: i.createdAt ? date(i.createdAt, "تاریخ ثبت") : new Date(),
  }));
  const items = invoicesRaw.flatMap((inv) =>
    arr(inv.items, "ردیف‌ها").map((it) => ({
      id: int(it.id, "شناسه ردیف"),
      invoiceId: int(inv.id, "شناسه صورتحساب"),
      productId: it.productId === null || it.productId === undefined ? null : int(it.productId, "محصول ردیف"),
      date: date(it.date, "تاریخ ردیف"),
      havaleNo: strOr(it.havaleNo),
      productName: str(it.productName, "نام کالای ردیف"),
      weight: numOrNull(it.weight, "وزن"),
      fee: numOrNull(it.fee, "فی"),
      amount: num(it.amount ?? 0, "مبلغ ردیف"),
    })),
  );

  const s = isObj(data.setting) ? data.setting : null;
  if (s) {
    const fields = {
      companyName: strOr(s.companyName, "شرکت"),
      subtitle: strOr(s.subtitle),
      address: strOr(s.address),
      phone: strOr(s.phone),
      mobile: strOr(s.mobile),
      managerName: strOr(s.managerName),
      footerNote: strOr(s.footerNote),
      logo: typeof s.logo === "string" ? s.logo : null,
    };
    await tx.setting.upsert({ where: { id: 1 }, update: fields, create: { id: 1, ...fields } });
  }

  await tx.product.createMany({ data: products });
  await tx.customer.createMany({ data: customers });
  await tx.invoice.createMany({ data: invoices });
  await tx.invoiceItem.createMany({ data: items });

  // شمارنده شماره صورتحساب هر سال: از فایل، و اگر نبود از بیشترین شماره‌ی موجود
  const counters = new Map<number, number>();
  for (const c of arr(data.invoiceCounters, "شمارنده‌ها")) counters.set(int(c.year, "سال شمارنده"), int(c.last, "شمارنده"));
  for (const inv of invoices) counters.set(inv.year, Math.max(counters.get(inv.year) ?? 0, inv.number));
  for (const [year, last] of counters) {
    await tx.invoiceCounter.upsert({ where: { year }, update: { last }, create: { year, last } });
  }

  // ادامه‌ی شناسه‌های خودکار بعد از بیشترین شناسه‌ی واردشده
  for (const [table, col] of SEQUENCES) {
    await tx.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${table}"', '${col}'), COALESCE((SELECT MAX("${col}") FROM "${table}"), 0) + 1, false)`,
    );
  }

  return { products: products.length, customers: customers.length, invoices: invoices.length, items: items.length };
}
