import Link from "next/link";
import { db } from "@/lib/db";
import { fmtRial, toFaDigits } from "@/lib/format";
import { IconPlus, IconYarn } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { ProductActions } from "./product-actions";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await db.product.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-4">
      <PageHeader title="محصولات" sub={products.length ? `${toFaDigits(products.length)} محصول` : undefined}>
        <Link href="/products/new" className="btn btn-primary !px-4">
          <IconPlus size={20} />
          محصول جدید
        </Link>
      </PageHeader>
      {products.length === 0 ? (
        <div className="card empty">
          <span className="empty-icon"><IconYarn size={30} /></span>
          <b className="text-fg">هنوز محصولی ثبت نشده</b>
          <p className="text-sm">نوع نخ و قیمت پیش‌فرض هر کیلو را یک بار ثبت کنید تا موقع ثبت ردیف‌ها انتخاب شوند.</p>
          <Link href="/products/new" className="btn btn-primary mt-2">
            <IconPlus size={20} />
            ثبت اولین محصول
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {products.map((p) => (
            <li key={p.id} className="card flex items-start gap-3 !p-4">
              <Link href={`/products/${p.id}`} className="flex-1 min-w-0 space-y-1.5 rounded-lg">
                <b className="block truncate text-[1.05rem]">{p.name}</b>
                <p className="text-sm text-muted">
                  قیمت پیش‌فرض:{" "}
                  <span className="font-bold text-fg tabular-nums">{fmtRial(p.price)}</span> ریال
                </p>
              </Link>
              <ProductActions id={p.id} name={p.name} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
