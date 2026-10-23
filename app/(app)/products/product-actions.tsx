"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProduct } from "@/app/actions";
import { IconPencil, IconSpinner, IconTrash } from "@/components/icons";

/** دکمه‌های ویرایش و حذف هر محصول در لیست */
export function ProductActions({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <div className="flex items-center gap-2 shrink-0">
      {error && <span className="sr-only" role="alert">{error}</span>}
      <Link href={`/products/${id}`} className="icon-btn" aria-label={`ویرایش ${name}`} title="ویرایش">
        <IconPencil size={20} />
      </Link>
      <button
        type="button"
        className="icon-btn icon-btn-danger"
        aria-label={`حذف ${name}`}
        title={error || "حذف"}
        disabled={pending}
        onClick={() => {
          if (!confirm(`محصول «${name}» حذف شود؟\nفاکتورهای قبلی تغییری نمی‌کنند.`)) return;
          start(async () => {
            try {
              const r = await deleteProduct(id);
              if (r.error) {
                setError(r.error);
                alert(r.error);
                return;
              }
              router.refresh();
            } catch {
              setError("حذف انجام نشد");
              alert("حذف انجام نشد");
            }
          });
        }}
      >
        {pending ? <IconSpinner size={20} /> : <IconTrash size={20} />}
      </button>
    </div>
  );
}
