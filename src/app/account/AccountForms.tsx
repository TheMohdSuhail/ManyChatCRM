"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";
import { changePassword, logoutEverywhere, updateProfile } from "./actions";

export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <p className="alert-error">{state.error}</p>}
      {state?.ok && <p className="alert-ok">{state.ok}</p>}
      <label className="block">
        <span className="label">Name</span>
        <input className="input" name="name" defaultValue={name} required />
      </label>
      <button className="btn-primary" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Save
      </button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      {state?.error && <p className="alert-error">{state.error}</p>}
      {state?.ok && <p className="alert-ok">{state.ok}</p>}
      <label className="block">
        <span className="label">Current password</span>
        <input className="input" type="password" name="current" autoComplete="current-password" required />
      </label>
      <label className="block">
        <span className="label">New password (min 8)</span>
        <input className="input" type="password" name="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label className="block">
        <span className="label">Confirm new password</span>
        <input className="input" type="password" name="confirm" autoComplete="new-password" minLength={8} required />
      </label>
      <button className="btn-primary" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Change password
      </button>
    </form>
  );
}

export function LogoutEverywhereButton() {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-danger"
      disabled={pending}
      onClick={() => {
        if (confirm("Sab devices se logout karein?")) start(() => logoutEverywhere());
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Logout everywhere
    </button>
  );
}
