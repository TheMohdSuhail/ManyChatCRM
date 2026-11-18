"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Stats = { conversations: number; newLeads: number; updatedLeads: number; newMessages: number; skipped: number; errors: string[] };
type Resp = { ok: boolean; error?: string; done?: boolean; cursor?: string | null; startedAt?: number; stats?: Stats };

const zero = { conversations: 0, newLeads: 0, updatedLeads: 0, newMessages: 0, errors: [] as string[] };

export function InstagramImport({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState<null | "new" | "full">(null);
  const [total, setTotal] = useState(zero);
  const [status, setStatus] = useState<string | null>(null);

  async function run(mode: "new" | "full") {
    if (mode === "full" && !confirm("Saari Instagram chats import hongi. Isme kuch minute lag sakte hain — page band mat karna. Shuru karein?")) return;
    setRunning(mode);
    setStatus("Chal raha hai…");
    const t = { conversations: 0, newLeads: 0, updatedLeads: 0, newMessages: 0, errors: [] as string[] };
    setTotal(t);
    let cursor: string | null = null;
    let startedAt: number | null = null;
    try {
      for (;;) {
        const res = await fetch("/api/instagram/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, cursor, startedAt }),
        });
        const r = (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as Resp;
        if (!r.ok || !r.stats) throw new Error(r.error ?? "Sync fail");
        t.conversations += r.stats.conversations;
        t.newLeads += r.stats.newLeads;
        t.updatedLeads += r.stats.updatedLeads;
        t.newMessages += r.stats.newMessages;
        t.errors = [...t.errors, ...r.stats.errors].slice(-20);
        setTotal({ ...t });
        if (r.done) break;
        cursor = r.cursor ?? null;
        startedAt = r.startedAt ?? null;
      }
      setStatus("Ho gaya ✓");
      router.refresh();
    } catch (e) {
      setStatus(`Ruk gaya: ${e instanceof Error ? e.message : String(e)} — dobara button dabao, jo save ho chuka wo safe hai.`);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={disabled || running !== null} onClick={() => run("new")}>
          {running === "new" ? "Sync ho raha hai…" : "↻ Nayi chats sync karo"}
        </button>
        <button className="btn-secondary" disabled={disabled || running !== null} onClick={() => run("full")}>
          {running === "full" ? "Import ho raha hai…" : "⬇ Saari purani chats import karo"}
        </button>
      </div>
      {status && (
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="font-medium">{status}</div>
          <div className="mt-1 text-slate-600">
            {total.conversations} chats dekhi · {total.newLeads} nayi leads · {total.updatedLeads} purani leads update · {total.newMessages} messages
          </div>
          {total.errors.length > 0 && (
            <details className="mt-1 text-xs text-red-600">
              <summary>{total.errors.length} errors</summary>
              <ul className="mt-1 list-disc pl-4">
                {total.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
