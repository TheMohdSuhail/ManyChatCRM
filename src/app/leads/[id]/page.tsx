import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/leads";
import { addNote, updateLeadDetails } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/users";
import { ArrowLeft, Mail, MessageCircle, Phone } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtIST, toISTInput } from "@/lib/time";
import { StatusSelect, SyncButton, DeleteLeadButton, DeleteNoteButton, InstagramChatRefreshButton } from "@/components/LeadControls";

export const dynamic = "force-dynamic";

// Sab time India (IST) me
const fmt = (d: Date) => fmtIST(d);
const toLocalInput = (d: Date | null) => toISTInput(d);

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      notes: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
      messages: { orderBy: { sentAt: "asc" }, take: 200 },
    },
  });
  if (!lead) notFound();
  const user = await requireUser();

  const tags = parseJson<string[]>(lead.tags, []);
  const customFields = parseJson<Record<string, unknown>>(lead.customFields, {});
  const save = updateLeadDetails.bind(null, lead.id);
  const note = addNote.bind(null, lead.id);

  return (
    <AppShell>
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All leads
      </Link>

      <div className="card mb-6 p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Avatar src={lead.profilePic} name={lead.name} size={64} />
            <div className="min-w-0 flex-1">
              <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
                <span className="break-words">{lead.name ?? "Unknown"}</span> <StatusBadge status={lead.status} />
              </h1>
              {lead.igUsername && (
                <a href={`https://instagram.com/${lead.igUsername}`} target="_blank" rel="noreferrer" className="text-sm text-pink-600 hover:underline">
                  @{lead.igUsername}
                </a>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <StatusSelect key={lead.status} id={lead.id} status={lead.status} />
            {lead.liveChatUrl && (
              <a href={lead.liveChatUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                <MessageCircle className="h-4 w-4" /> ManyChat Live Chat
              </a>
            )}
            {!lead.subscriberId.startsWith("ig:") && <SyncButton id={lead.id} />}
            {(lead.igConversationId || lead.igId) && <InstagramChatRefreshButton id={lead.id} />}
          </div>
        </div>

        {(lead.phone || lead.email) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="btn-secondary">
                <Phone className="h-4 w-4" /> {lead.phone}
              </a>
            )}
            {lead.phone && (
              <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="btn-secondary text-green-700">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} className="btn-secondary max-w-full">
                <Mail className="h-4 w-4 shrink-0" /> <span className="truncate">{lead.email}</span>
              </a>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>Pehli baar aayi: {fmt(lead.createdAt)}</span>
          {lead.lastWebhookAt && <span>Last aayi: {fmt(lead.lastWebhookAt)}</span>}
          {lead.source && <span>Source: {lead.source}</span>}
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

          {lead.messages.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-3 font-medium">
                Instagram chat <span className="text-xs font-normal text-slate-400">(IST · Instagram sirf last 20 messages deta hai)</span>
              </h2>
              <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
                {lead.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl sm:max-w-[75%] px-3 py-2 text-sm ${
                        m.fromMe ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text ?? <i className="opacity-70">[photo / video / share]</i>}</p>
                      <div className={`mt-1 text-[10px] ${m.fromMe ? "text-indigo-200" : "text-slate-400"}`}>{fmt(m.sentAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
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
                  <li key={n.id} className="rounded-xl bg-slate-50 p-3">
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
            <Field label="Follow-up date (IST)" name="followUpAt" type="datetime-local" defaultValue={toLocalInput(lead.followUpAt)} />
            <button className="btn-primary w-full">Save</button>
          </form>

          <div className="card p-5 text-sm">
            <h2 className="mb-3 font-medium">ManyChat data</h2>
            <dl className="space-y-2">
              <Row k="Subscriber ID" v={lead.subscriberId.startsWith("ig:") ? "— (sirf Instagram DM se)" : lead.subscriberId} />
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

          {user.role === "ADMIN" && <DeleteLeadButton id={lead.id} />}
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, defaultValue, ...rest }: { label: string; name: string; type?: string; defaultValue?: string | null; placeholder?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
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
