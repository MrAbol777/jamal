import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logout } from "../actions";
import { NavLinks } from "./nav";
import { LogoutButton } from "./logout-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <div className="min-h-dvh app-shell">
      <header className="sticky top-0 z-20 bg-brand text-white shadow-[0_1px_0_rgba(255,255,255,0.06),0_4px_16px_-8px_rgba(15,23,42,0.5)]">
        <div className="mx-auto max-w-5xl flex items-center gap-3 px-4 h-14">
          <Link href="/" className="flex items-center gap-2 font-bold min-h-11 shrink-0">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-white/15 text-sm">ن</span>
            <span className="truncate">حسابداری فروش نخ</span>
          </Link>
          <nav className="hidden md:flex gap-1 flex-1 mr-4" aria-label="منوی اصلی">
            <NavLinks variant="top" />
          </nav>
          <form action={logout} className="mr-auto">
            <LogoutButton />
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-4 md:pt-6">{children}</main>
      <nav
        aria-label="منوی اصلی"
        className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white/95 backdrop-blur border-t border-line grid grid-cols-4 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-10px_rgba(15,23,42,0.25)]"
      >
        <NavLinks variant="bottom" />
      </nav>
    </div>
  );
}
