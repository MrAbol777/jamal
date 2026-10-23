"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { parseNum } from "@/lib/format";
import { createInvoice, updateInvoice, validate, type InvoiceInput } from "@/lib/invoice";

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
export type ProductPayload = { id?: number; name: string; price: string; cheles: string[] };

export async function saveProduct(p: ProductPayload): Promise<ActionResult> {
  await requireUser();
  const name = p.name.trim();
  if (!name) return { error: "نام محصول را وارد کنید" };
  const price = parseNum(p.price);
  const cheles = [...new Set(p.cheles.map((c) => c.trim()).filter(Boolean))];
  if (p.id) {
    await db.$transaction([
      db.product.update({ where: { id: p.id }, data: { name, price } }),
      db.chele.deleteMany({ where: { productId: p.id } }),
      db.chele.createMany({ data: cheles.map((c) => ({ productId: p.id!, name: c })) }),
    ]);
  } else {
    await db.product.create({ data: { name, price, cheles: { create: cheles.map((c) => ({ name: c })) } } });
  }
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
  if (n > 0) return { error: `این مشتری ${n} فاکتور دارد و قابل حذف نیست` };
  await db.customer.delete({ where: { id } });
  revalidatePath("/customers");
  return { ok: true };
}

/* ---------- فاکتور ---------- */
export async function saveInvoice(id: number | null, input: InvoiceInput): Promise<ActionResult & { id?: number }> {
  await requireUser();
  const err = validate(input);
  if (err) return { error: err };
  const savedId = id ? (await updateInvoice(id, input), id) : await createInvoice(input);
  revalidatePath("/");
  return { ok: true, id: savedId };
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
  const data: { companyName: string; address: string; phone: string; footerNote: string; logo?: string | null } = {
    companyName: String(fd.get("companyName") ?? "").trim(),
    address: String(fd.get("address") ?? "").trim(),
    phone: String(fd.get("phone") ?? "").trim(),
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
