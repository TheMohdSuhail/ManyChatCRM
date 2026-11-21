"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { KeyRound, Loader2, Trash2, UserPlus } from "lucide-react";
import { createUser, deleteUser, resetUserPassword } from "./actions";

export function AddUserForm() {
  const [state, action, pending] = useActionState(createUser, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      {state?.error && <p className="alert-error">{state.error}</p>}
      {state?.ok && <p className="alert-ok">{state.ok}</p>}
      <label className="block">
        <span className="label">Name</span>
        <input className="input" name="name" required />
      </label>
      <label className="block">
        <span className="label">Email</span>
        <input className="input" type="email" name="email" inputMode="email" autoComplete="off" required />
      </label>
      <label className="block">
        <span className="label">Password (min 8)</span>
        <input className="input" type="text" name="password" autoComplete="new-password" minLength={8} required />
      </label>
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Add member
      </button>
    </form>
  );
}

export function UserRowActions({ id, role, isMe, name }: { id: string; role: string; isMe: boolean; name: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      try {
        await fn();
      } catch (e) {
        setMsg({ error: e instanceof Error ? e.message : String(e) });
      }
    });

  return (
    <div className="flex flex-col gap-1 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn-secondary h-9 min-h-9 px-2.5"
          disabled={pending}
          title="Password reset"
          onClick={() => {
            const pw = prompt(`${name} ka naya password (min 8 characters):`);
            if (pw) start(async () => setMsg((await resetUserPassword(id, pw)) ?? null));
          }}
        >
          <KeyRound className="h-4 w-4" />
          <span className="sm:hidden lg:inline">Reset</span>
        </button>
        {!isMe && role !== "ADMIN" && (
          <button
            className="btn-danger h-9 min-h-9 px-2.5"
            disabled={pending}
            title="Delete user"
            onClick={() => {
              if (confirm(`${name} ko delete karein? Wo login nahi kar payenge.`)) run(() => deleteUser(id));
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {msg?.error && <span className="text-xs text-red-600">{msg.error}</span>}
      {msg?.ok && <span className="text-xs text-green-700">{msg.ok}</span>}
    </div>
  );
}
