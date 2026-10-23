"use client";

import { useActionState } from "react";
import { login, type ActionResult } from "../actions";
import { IconLock, IconSpinner, IconUser, IconYarn } from "@/components/icons";

export default function LoginPage() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(login, {});
  return (
    <main className="relative min-h-dvh flex flex-col items-center justify-center p-4 overflow-hidden">
      <div aria-hidden className="absolute inset-x-0 top-0 h-[42dvh] bg-brand rounded-b-[40px]" />
      <div className="relative w-full max-w-sm space-y-5">
        <div className="text-center text-white space-y-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-white/15 ring-1 ring-white/25 grid place-items-center">
            <IconYarn size={34} />
          </div>
          <h1 className="text-xl font-bold">حسابداری فروش نخ</h1>
          <p className="text-sm text-white/75">ثبت فروش و صدور فاکتور</p>
        </div>

        <form action={action} className="card !p-5 space-y-4 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.35)]">
          <h2 className="font-bold text-lg">ورود به سیستم</h2>
          <div>
            <label className="label" htmlFor="username">نام کاربری</label>
            <div className="relative">
              <IconUser size={20} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input id="username" name="username" className="input num !pr-11" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="password">رمز عبور</label>
            <div className="relative">
              <IconLock size={20} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input id="password" name="password" type="password" className="input num !pr-11" autoComplete="current-password" required />
            </div>
          </div>
          {state.error && <p className="alert alert-error" role="alert">{state.error}</p>}
          <button className="btn btn-primary w-full" disabled={pending}>
            {pending && <IconSpinner size={20} />}
            {pending ? "در حال ورود..." : "ورود"}
          </button>
        </form>
      </div>
    </main>
  );
}
