import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/leads";
import { addNote, updateLeadDetails } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusSelect, SyncButton, DeleteLeadButton, DeleteNoteButton } from "@/components/LeadControls";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

function toLocalInput(d: Date | null) {
  if (!d) return "";
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      notes: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!lead) notFound();

  const tags = parseJson<string[]>(lead.tags, []);
  const customFields = parseJson<Record<string, unknown>>(lead.customFields, {});
  const save = updateLeadDetails.bind(null, lead.id);
  const note = addNote.bind(null, lead.id);

  return (
    <AppShell>
      <Link href="/leads" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-900">
        ← All leads
      </Link>

      <div className="card mb-6 flex flex-wrap items-center gap-4 p-5">
        <Avatar src={lead.profilePic} name={lead.name} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            {lead.name ?? "Unknown"} <StatusBadge status={lead.status} />
          </h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            {lead.igUsername && (
              <a href={`https://instagram.com/${lead.igUsername}`} target="_blank" rel="noreferrer" className="text-pink-600 hover:underline">
                @{lead.igUsername}
              </a>
            )}
            {lead.phone && <a href={`tel:${lead.phone}`}>{lead.phone}</a>}
            {lead.phone && (
              <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline">
                WhatsApp
              </a>
            )}
            {lead.email && <a href={`mailto:${lead.email}`}>{lead.email}</a>}
            <span>Aayi: {fmt(lead.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusSelect key={lead.status} id={lead.id} status={lead.status} />
          {lead.liveChatUrl && (
            <a href={lead.liveChatUrl} target="_blank" rel="noreferrer" className="btn-secondary">
              💬 ManyChat Live Chat
            </a>
          )}
          <SyncButton id={lead.id} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {lead.lastInputText && (
            <div className="card p-5">
              <h2 className="mb-2 text-sm font-medium text-slate-500">Last message / comment</h2>
              <p className="whitespace-pre-wrap">{lead.lastInputText}</p>
            </div>
          )}

          <div className="card p-5">
            <h2 className="mb-3 font-medium">Notes</h2>
            <form action={note} className="mb-4 space-y-2">
              <textarea name="body" rows={3} className="input" placeholder="Call kiya, price bataya, kal follow-up…" required />
              <button className="btn-primary">Add note</button>
            </form>
            {lead.notes.length === 0 ? (
              <p className="text-sm text-slate-500">Abhi koi note nahi.</p>
            ) : (
              <ul className="space-y-3">
                {lead.notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-slate-50 p-3">
                    <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                    <div className="mt-1 flex justify-between text-xs text-slate-400">
                      <span>{fmt(n.createdAt)}</span>
                      <DeleteNoteButton noteId={n.id} leadId={lead.id} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-medium">Activity</h2>
            <ol className="relative space-y-3 border-l border-slate-200 pl-4">
              {lead.activities.map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-indigo-400" />
                  <div>{a.message}</div>
                  <div className="text-xs text-slate-400">{fmt(a.createdAt)}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="space-y-6">
          <form action={save} className="card space-y-3 p-5">
            <h2 className="font-medium">Details</h2>
            <Field label="Name" name="name" defaultValue={lead.name} />
            <Field label="Phone" name="phone" defaultValue={lead.phone} />
            <Field label="Email" name="email" type="email" defaultValue={lead.email} />
            <Field label="Source" name="source" defaultValue={lead.source} placeholder="Reel / keyword / ad" />
            <Field label="Deal value (₹)" name="dealValue" type="number" defaultValue={lead.dealValue?.toString()} />
            <Field label="Follow-up date" name="followUpAt" type="datetime-local" defaultValue={toLocalInput(lead.followUpAt)} />
            <button className="btn-primary w-full">Save</button>
          </form>

          <div className="card p-5 text-sm">
            <h2 className="mb-3 font-medium">ManyChat data</h2>
            <dl className="space-y-2">
              <Row k="Subscriber ID" v={lead.subscriberId} />
              {lead.igId && <Row k="IG ID" v={lead.igId} />}
              {lead.subscribedAt && <Row k="Subscribed" v={fmt(lead.subscribedAt)} />}
              {lead.lastInteractionAt && <Row k="Last interaction" v={fmt(lead.lastInteractionAt)} />}
              {Object.entries(customFields).map(([k, v]) => (
                <Row key={k} k={k} v={typeof v === "object" ? JSON.stringify(v) : String(v)} />
              ))}
            </dl>
            {tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span key={t} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <DeleteLeadButton id={lead.id} />
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, defaultValue, ...rest }: { label: string; name: string; type?: string; defaultValue?: string | null; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <input className="input" defaultValue={defaultValue ?? ""} {...rest} />
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{k}</dt>
      <dd className="break-all text-right">{v}</dd>
    </div>
  );
}
