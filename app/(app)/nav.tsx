"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconInvoice, IconSettings, IconUsers, IconYarn } from "@/components/icons";

const LINKS = [
  { href: "/", label: "فاکتورها", Icon: IconInvoice },
  { href: "/products", label: "محصولات", Icon: IconYarn },
  { href: "/customers", label: "مشتری‌ها", Icon: IconUsers },
  { href: "/settings", label: "تنظیمات", Icon: IconSettings },
];

export function NavLinks({ variant }: { variant: "top" | "bottom" }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/invoices") : path.startsWith(href));
  return (
    <>
      {LINKS.map(({ href, label, Icon }) => {
        const on = active(href);
        return variant === "top" ? (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`flex items-center gap-2 px-3 min-h-10 rounded-lg text-sm transition-colors ${on ? "bg-white/15 font-bold text-white" : "text-white/75 hover:text-white hover:bg-white/10"}`}
          >
            <Icon size={18} />
            {label}
          </Link>
        ) : (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`relative flex flex-col items-center justify-center h-16 text-[0.72rem] gap-1 transition-colors ${on ? "text-brand font-bold" : "text-muted"}`}
          >
            <span className={`grid place-items-center h-7 w-12 rounded-full transition-colors ${on ? "bg-brand-soft" : ""}`}>
              <Icon size={22} strokeWidth={on ? 2.1 : 1.8} />
            </span>
            {label}
          </Link>
        );
      })}
    </>
  );
}
