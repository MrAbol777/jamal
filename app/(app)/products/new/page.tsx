import { PageHeader } from "@/components/page-header";
import { ProductForm } from "../product-form";

export default function NewProduct() {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <PageHeader title="ثبت محصول جدید" back="/products" />
      <ProductForm />
    </div>
  );
}
