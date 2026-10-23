"use client";

import { useFormStatus } from "react-dom";
import { IconLogout, IconSpinner } from "@/components/icons";

export function LogoutButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="flex items-center gap-1.5 text-sm text-white/85 hover:text-white min-h-11 px-3 rounded-lg hover:bg-white/10 transition-colors"
      disabled={pending}
    >
      {pending ? <IconSpinner size={18} /> : <IconLogout size={18} />}
      خروج
    </button>
  );
}
