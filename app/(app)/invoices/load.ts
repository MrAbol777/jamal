import { db } from "@/lib/db";

export async function loadFormData() {
  const [products, customers] = await Promise.all([
    db.product.findMany({ where: { active: true }, include: { cheles: { orderBy: { id: "asc" } } }, orderBy: { name: "asc" } }),
    db.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    products: products.map((p) => ({ id: p.id, name: p.name, price: p.price, cheles: p.cheles.map((c) => c.name) })),
    customers,
  };
}
