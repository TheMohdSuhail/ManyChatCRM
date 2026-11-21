import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STATUSES } from "@/lib/statuses";
import { PageHeader } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { getCurrentUser } from "@/lib/users";
import { ArrowRight, CalendarDays, Sparkles, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { DashboardTabs } from "@/components/DashboardTabs";
import { fmtIST, istDayKey, startOfISTDay } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  // India time ke hisaab se "aaj" (raat 12 baje IST se)
  const startOfToday = startOfISTDay();
  const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 86400000);

  const [user, total, newToday, byStatus, recent, dueFollowUps, arrivals, dms] = await Promise.all([
    getCurrentUser(),
    prisma.lead.count(),
    prisma.lead.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.lead.groupBy({ by: ["status"], _count: true }),
    prisma.lead.findMany({
      orderBy: [{ lastWebhookAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.lead.findMany({
      where: { followUpAt: { lte: new Date(Date.now() + 86400000) }, status: { notIn: ["CONVERTED", "LOST"] } },
      orderBy: { followUpAt: "asc" },
      take: 8,
    }),
    // Har baar jab ManyChat se lead aayi (nayi + wapas aane wali) — Activity log se
    prisma.activity.findMany({
      where: { type: { in: ["CREATED", "WEBHOOK"] }, createdAt: { gte: sevenDaysAgo } },
      select: { leadId: true, createdAt: true },
    }),
    // Instagram DM import se aaye messages (user ne bheje) — asli message time se
    prisma.message.findMany({
      where: { fromMe: false, sentAt: { gte: sevenDaysAgo } },
      select: { leadId: true, sentAt: true },
    }),
  ]);

  const counts = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
  const converted = counts.CONVERTED ?? 0;
  const conversion = total ? Math.round((converted / total) * 100) : 0;

  // Din ke hisaab se unique leads (ek user din me 3 baar aaye to 1 gina jayega)
  const perDay = new Map<string, Set<string>>();
  for (const a of [...arrivals.map((x) => ({ leadId: x.leadId, at: x.createdAt })), ...dms.map((x) => ({ leadId: x.leadId, at: x.sentAt }))]) {
    const key = istDayKey(a.at);
    if (!perDay.has(key)) perDay.set(key, new Set());
    perDay.get(key)!.add(a.leadId);
  }
  const activeToday = perDay.get(istDayKey(startOfToday))?.size ?? 0;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sevenDaysAgo.getTime() + i * 86400000);
    return {
      label: fmtIST(d, { weekday: "short" }),
      count: perDay.get(istDayKey(d))?.size ?? 0,
    };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  const hour = Number(fmtIST(new Date(), { hour: "numeric", hourCycle: "h23" }));
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const weekTotal = days.reduce((a, d) => a + d.count, 0);

  return (
    <>
      <PageHeader
        title={`${greet}${user ? `, ${user.name.split(" ")[0]}` : ""} 👋`}
        sub={`Aaj ${fmtIST(new Date(), { weekday: "long", day: "numeric", month: "long" })}`}
        actions={
          <span className="hidden sm:block">
            <Link href="/leads" className="btn-primary">
              <Users className="h-4 w-4" /> All leads
            </Link>
          </span>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:mb-6 sm:gap-4 xl:grid-cols-4">
        <Stat icon={Users} tone="indigo" label="Total leads" value={total} />
        <Stat
          icon={CalendarDays}
          tone="pink"
          label="Aaj ki leads"
          value={activeToday}
          sub={`${newToday} nayi · ${Math.max(0, activeToday - newToday)} wapas`}
        />
        <Stat icon={Sparkles} tone="blue" label="New (untouched)" value={counts.NEW ?? 0} href="/leads?status=NEW" />
        <Stat icon={TrendingUp} tone="green" label="Conversion" value={`${conversion}%`} sub={`${converted} converted`} />
      </div>

      <div className="mb-4 grid gap-3 sm:mb-6 sm:gap-4 lg:grid-cols-3">
        <div className="card p-4 sm:p-5 lg:col-span-2">
          <div className="mb-3 flex sm:mb-5 items-baseline justify-between gap-2">
            <h2 className="font-medium">Pichle 7 din</h2>
            <span className="text-sm text-slate-500">{weekTotal} lead-days</span>
          </div>
          <div className="flex h-28 items-end gap-2 sm:h-44 sm:gap-4">
            {days.map((d, i) => {
              const today = i === days.length - 1;
              return (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                  <span className={`text-xs font-medium ${today ? "text-indigo-600" : "text-slate-500"}`}>{d.count}</span>
                  <div
                    className={`w-full max-w-12 rounded-lg ${today ? "bg-gradient-to-t from-indigo-600 to-pink-500" : "bg-indigo-200"}`}
                    style={{ height: `${(d.count / maxDay) * 100}%`, minHeight: 4 }}
                  />
                  <span className={`text-xs ${today ? "font-semibold text-slate-900" : "text-slate-500"}`}>{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card p-4 sm:p-5">
          <h2 className="mb-2 font-medium sm:mb-4">Pipeline</h2>
          <ul className="grid grid-cols-2 gap-x-2 sm:grid-cols-3 lg:grid-cols-1 lg:gap-y-1">
            {STATUSES.map((s) => {
              const n = counts[s.value] ?? 0;
              return (
                <li key={s.value}>
                  <Link href={`/leads?status=${s.value}`} className="group block rounded-xl px-1.5 py-1.5 hover:bg-slate-50 sm:px-2 sm:py-2">
                    <div className="flex items-center justify-between">
                      <StatusBadge status={s.value} />
                      <span className="text-sm font-semibold">{n}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-indigo-500/70" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <DashboardTabs
        tabs={[
          {
            label: "Latest leads",
            content: <LeadList title="Latest leads" href="/leads" leads={recent} empty="Abhi koi lead nahi. Setup page dekho." />,
          },
          {
            label: "Follow-up due",
            count: dueFollowUps.length,
            content: <LeadList title="Follow-up due (24 ghante)" leads={dueFollowUps} empty="Koi follow-up pending nahi 🎉" showFollowUp />,
          },
        ]}
      />
    </>
  );
}

const TONES = {
  indigo: "bg-indigo-50 text-indigo-600",
  pink: "bg-pink-50 text-pink-600",
  blue: "bg-blue-50 text-blue-600",
  green: "bg-green-50 text-green-600",
} as const;

function Stat({
  icon: Icon,
  tone,
  label,
  value,
  sub,
  href,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  label: string;
  value: number | string;
  sub?: string;
  href?: string;
}) {
  const body = (
    <div className={`card h-full p-3.5 sm:p-5 ${href ? "transition hover:border-indigo-200 hover:shadow-md" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-slate-500 sm:text-sm">{label}</div>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg sm:h-9 sm:w-9 ${TONES[tone]}`}>
          <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
        </span>
      </div>
      <div className="mt-0.5 text-xl font-semibold tracking-tight sm:mt-1 sm:text-3xl">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-slate-400">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/** Mobile par har list me itni rows — baaki "View all" me */
const MOBILE_ROWS = 5;

type MiniLead = {
  id: string;
  name: string | null;
  igUsername: string | null;
  profilePic: string | null;
  status: string;
  createdAt: Date;
  lastWebhookAt: Date | null;
  followUpAt: Date | null;
};

function LeadList({
  title,
  href,
  leads,
  empty,
  showFollowUp,
}: {
  title: string;
  href?: string;
  leads: MiniLead[];
  empty: string;
  showFollowUp?: boolean;
}) {
  return (
    <div className="card p-4 sm:p-5">
      <div className={`mb-2 items-center justify-between max-lg:justify-end ${href ? "flex" : "hidden lg:flex"}`}>
        <h2 className="font-medium max-lg:hidden">{title}</h2>
        {href && (
          <Link href={href} className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {leads.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="-mx-2 divide-y divide-slate-100">
          {leads.map((l, i) => (
            <li key={l.id} className={i >= MOBILE_ROWS ? "max-lg:hidden" : undefined}>
              <Link href={`/leads/${l.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-slate-50">
                <Avatar src={l.profilePic} name={l.name} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{l.name ?? "Unknown"}</div>
                  <div className="truncate text-xs text-slate-500">
                    {l.igUsername ? `@${l.igUsername}` : "—"} · {fmtIST(showFollowUp ? l.followUpAt : (l.lastWebhookAt ?? l.createdAt))}
                  </div>
                </div>
                <StatusBadge status={l.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
