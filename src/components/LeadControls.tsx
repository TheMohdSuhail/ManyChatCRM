"use client";

import { useState, useTransition } from "react";
import { STATUSES } from "@/lib/statuses";
import { updateLeadStatus, syncLeadFromManyChat, deleteLead, deleteNote, refreshLeadInstagramChat } from "@/app/actions";

export function StatusSelect({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      className="input w-auto font-medium"
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        start(() => updateLeadStatus(id, v));
      }}
    >
      {STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

export function SyncButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <button
        className="btn-secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await syncLeadFromManyChat(id);
            setMsg(r.ok ? "Synced ✓" : r.error ?? "Sync fail");
          })
        }
      >
        {pending ? "Syncing…" : "↻ Sync from ManyChat"}
      </button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}

export function DeleteLeadButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-danger"
      disabled={pending}
      onClick={() => {
        if (confirm("Ye lead aur uske saare notes delete ho jayenge. Pakka?")) start(() => deleteLead(id));
      }}
    >
      Delete
    </button>
  );
}

export function DeleteNoteButton({ noteId, leadId }: { noteId: string; leadId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="text-xs text-slate-400 hover:text-red-600"
      disabled={pending}
      onClick={() => start(() => deleteNote(noteId, leadId))}
    >
      delete
    </button>
  );
}

export function InstagramChatRefreshButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <button
        className="btn-secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await refreshLeadInstagramChat(id);
            setMsg(r.ok ? `✓ ${r.message}` : r.error ?? "Fail");
          })
        }
      >
        {pending ? "Refreshing…" : "↻ Instagram chat refresh"}
      </button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}
