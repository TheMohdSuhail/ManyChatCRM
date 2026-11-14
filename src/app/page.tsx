import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STATUSES } from "@/lib/statuses";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 86400000);

  const [total, today, byStatus, recent, dueFollowUps, last7] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.lead.findMany({
      where: { followUpAt: { lte: new Date(Date.now() + 86400000) }, status: { notIn: ["CONVERTED", "LOST"] } },
      orderBy: { followUpAt: "asc" },
      take: 8,
    }),
    prisma.lead.findMany({ where: { createdAt: { gte: sevenDaysAgo } }, select: { createdAt: true } }),
  ]);

  const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
  const converted = counts.CONVERTED ?? 0;
  const conversion = total ? Math.round((converted / total) * 100) : 0;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sevenDaysAgo.getTime() + i * 86400000);
    const key = d.toDateString();
    return {
      label: d.toLocaleDateString("en-IN", { weekday: "short" }),
      count: last7.filter((l) => l.createdAt.toDateString() === key).length,
    };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total Leads" value={total} />
        <Stat label="Aaj ki Leads" value={today} />
        <Stat label="New (untouched)" value={counts.NEW ?? 0} />
        <Stat label="Conversion" value={`${conversion}%`} sub={`${converted} converted`} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-medium">Pichle 7 din</h2>
          <div className="flex h-40 items-end gap-3">
            {days.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs text-slate-500">{d.count}</span>
                <div className="w-full rounded-t-md bg-indigo-500" style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: 2 }} />
                <span className="text-xs text-slate-500">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-medium">Pipeline</h2>
          <ul className="space-y-2">
            {STATUSES.map((s) => (
              <li key={s.value}>
                <Link href={`/leads?status=${s.value}`} className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-slate-50">
                  <StatusBadge status={s.value} />
                  <span className="font-medium">{counts[s.value] ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LeadList title="Latest Leads" leads={recent} empty="Abhi koi lead nahi. ManyChat Setup page dekho." />
        <LeadList title="Follow-up due (24 ghante)" leads={dueFollowUps} empty="Koi follow-up pending nahi 🎉" showFollowUp />
      </div>
    </AppShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

type MiniLead = {
  id: string;
  name: string | null;
  igUsername: string | null;
  status: string;
  createdAt: Date;
  followUpAt: Date | null;
};

function LeadList({ title, leads, empty, showFollowUp }: { title: string; leads: MiniLead[]; empty: string; showFollowUp?: boolean }) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 font-medium">{title}</h2>
      {leads.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {leads.map((l) => (
            <li key={l.id}>
              <Link href={`/leads/${l.id}`} className="flex items-center justify-between gap-3 py-2 hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="truncate font-medium">{l.name ?? "Unknown"}</div>
                  <div className="truncate text-xs text-slate-500">{l.igUsername ? `@${l.igUsername}` : "—"}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-slate-400">
                    {(showFollowUp ? l.followUpAt : l.createdAt)?.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  <StatusBadge status={l.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
