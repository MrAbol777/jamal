"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteInvoice } from "@/app/actions";
import { IconSpinner, IconTrash } from "@/components/icons";

export function DeleteInvoiceButton({ id }: { id: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      className="icon-btn icon-btn-danger"
      aria-label="حذف صورتحساب"
      title="حذف صورتحساب"
      disabled={pending}
      onClick={() => {
        if (!confirm("این صورتحساب با همه ردیف‌هایش برای همیشه حذف شود؟")) return;
        start(async () => {
          await deleteInvoice(id);
          router.replace("/");
          router.refresh();
        });
      }}
    >
      {pending ? <IconSpinner size={20} /> : <IconTrash size={20} />}
    </button>
  );
}
