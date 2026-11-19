"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { login } from "./actions";

function PasswordInput({ name, autoComplete, placeholder }: { name: string; autoComplete: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input className="input pr-11" type={show ? "text" : "password"} name={name} autoComplete={autoComplete} placeholder={placeholder} required />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 hover:text-slate-700"
        aria-label={show ? "Password chhupao" : "Password dikhao"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button className="btn-primary h-11 w-full text-base sm:text-sm" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <p className="alert-error">{state.error}</p>}
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="label">Email</span>
        <input className="input" type="email" name="email" autoComplete="email" inputMode="email" autoFocus required />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <PasswordInput name="password" autoComplete="current-password" />
      </label>
      <Submit pending={pending}>Login</Submit>
    </form>
  );
}
