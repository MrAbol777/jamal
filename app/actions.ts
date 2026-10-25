"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { parseNum } from "@/lib/format";
import {
  addItem,
  createStatement as createStatementRow,
  updateHeader,
  updateItem,
  validateHeader,
  validateItem,
  type HeaderInput,
  type ItemInput,
} from "@/lib/invoice";
import { fromJ, type J } from "@/lib/jalali";

export type ActionResult = { error?: string; ok?: boolean };

/* ---------- ورود / خروج ---------- */
export async function login(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const username = String(fd.get("username") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const user = await db.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "نام کاربری یا رمز عبور اشتباه است" };
  }
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

/* ---------- محصولات ---------- */
export type ProductPayload = { id?: number; name: string; price: string };

export async function saveProduct(p: ProductPayload): Promise<ActionResult> {
  await requireUser();
  const name = p.name.trim();
  if (!name) return { error: "نام محصول را وارد کنید" };
  const price = parseNum(p.price);
  if (p.id) await db.product.update({ where: { id: p.id }, data: { name, price } });
  else await db.product.create({ data: { name, price } });
  revalidatePath("/products");
  return { ok: true };
}

export async function deleteProduct(id: number): Promise<ActionResult> {
  await requireUser();
  // فاکتورهای قبلی نام کالا را جدا ذخیره دارند و تغییری نمی‌کنند
  await db.product.delete({ where: { id } });
  revalidatePath("/products");
  return { ok: true };
}

/* ---------- مشتری‌ها ---------- */
export async function saveCustomer(p: { id?: number; name: string; phone: string; address: string }): Promise<ActionResult & { id?: number }> {
  await requireUser();
  const name = p.name.trim();
  if (!name) return { error: "نام مشتری را وارد کنید" };
  const data = { name, phone: p.phone.trim(), address: p.address.trim() };
  const c = p.id ? await db.customer.update({ where: { id: p.id }, data }) : await db.customer.create({ data });
  revalidatePath("/customers");
  return { ok: true, id: c.id };
}

export async function deleteCustomer(id: number): Promise<ActionResult> {
  await requireUser();
  const n = await db.invoice.count({ where: { customerId: id } });
  if (n > 0) return { error: `این مشتری ${n} صورتحساب دارد و قابل حذف نیست` };
  await db.customer.delete({ where: { id } });
  revalidatePath("/customers");
  return { ok: true };
}

/* ---------- صورتحساب ---------- */
export async function createStatement(customerId: number, date: J): Promise<ActionResult & { id?: number }> {
  await requireUser();
  if (!customerId) return { error: "مشتری را انتخاب کنید" };
  if (!fromJ(date)) return { error: "تاریخ نامعتبر است" };
  const id = await createStatementRow(customerId, date);
  revalidatePath("/");
  return { ok: true, id };
}

export async function saveHeader(id: number, h: HeaderInput): Promise<ActionResult> {
  await requireUser();
  const err = validateHeader(h);
  if (err) return { error: err };
  await updateHeader(id, h);
  revalidatePath("/");
  revalidatePath(`/invoices/${id}`);
  return { ok: true };
}

export async function saveItem(invoiceId: number, itemId: number | null, i: ItemInput): Promise<ActionResult> {
  await requireUser();
  const err = validateItem(i);
  if (err) return { error: err };
  if (itemId) await updateItem(itemId, i);
  else await addItem(invoiceId, i);
  revalidatePath("/");
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true };
}

export async function deleteItem(itemId: number): Promise<ActionResult> {
  await requireUser();
  const it = await db.invoiceItem.delete({ where: { id: itemId } });
  revalidatePath("/");
  revalidatePath(`/invoices/${it.invoiceId}`);
  return { ok: true };
}

export async function deleteInvoice(id: number): Promise<ActionResult> {
  await requireUser();
  await db.invoice.delete({ where: { id } });
  revalidatePath("/");
  return { ok: true };
}

/* ---------- تنظیمات ---------- */
export async function saveSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const logoFile = fd.get("logo");
  const data: {
    companyName: string;
    subtitle: string;
    address: string;
    phone: string;
    mobile: string;
    managerName: string;
    footerNote: string;
    logo?: string | null;
  } = {
    companyName: String(fd.get("companyName") ?? "").trim(),
    subtitle: String(fd.get("subtitle") ?? "").trim(),
    address: String(fd.get("address") ?? "").trim(),
    phone: String(fd.get("phone") ?? "").trim(),
    mobile: String(fd.get("mobile") ?? "").trim(),
    managerName: String(fd.get("managerName") ?? "").trim(),
    footerNote: String(fd.get("footerNote") ?? "").trim(),
  };
  if (!data.companyName) return { error: "نام شرکت را وارد کنید" };
  if (logoFile instanceof File && logoFile.size > 0) {
    if (logoFile.size > 500_000) return { error: "حجم لوگو باید کمتر از ۵۰۰ کیلوبایت باشد" };
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(logoFile.type)) return { error: "فرمت لوگو باید PNG, JPG, WEBP یا SVG باشد" };
    data.logo = `data:${logoFile.type};base64,${Buffer.from(await logoFile.arrayBuffer()).toString("base64")}`;
  }
  if (fd.get("removeLogo") === "on") data.logo = null;
  await db.setting.update({ where: { id: 1 }, data });
  revalidatePath("/settings");
  return { ok: true };
}

export async function changePassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const uid = await requireUser();
  const cur = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  const user = await db.user.findUnique({ where: { id: uid } });
  if (!user || !(await bcrypt.compare(cur, user.passwordHash))) return { error: "رمز فعلی اشتباه است" };
  if (next.length < 6) return { error: "رمز جدید باید حداقل ۶ کاراکتر باشد" };
  await db.user.update({ where: { id: uid }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return { ok: true };
}
