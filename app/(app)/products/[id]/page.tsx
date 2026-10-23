import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { ProductForm } from "../product-form";

export const dynamic = "force-dynamic";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const p = await db.product.findUnique({ where: { id: Number((await params).id) }, include: { cheles: { orderBy: { id: "asc" } } } });
  if (!p) notFound();
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <PageHeader title="ویرایش محصول" sub={p.name} back="/products" />
      <ProductForm initial={{ id: p.id, name: p.name, price: p.price, cheles: p.cheles.map((c) => c.name) }} />
    </div>
  );
}
