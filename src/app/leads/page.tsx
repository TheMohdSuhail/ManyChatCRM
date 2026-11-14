import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STATUSES, isValidStatus } from "@/lib/statuses";
import { parseJson } from "@/lib/leads";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status && isValidStatus(sp.status) ? sp.status : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.LeadWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { igUsername: { contains: q.replace(/^@/, "") } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { source: { contains: q } },
            { lastInputText: { contains: q } },
            { subscriberId: q },
          ],
        }
      : {}),
  };

  const [leads, count] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.lead.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const qs = (over: Record<string, string | number>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(status && { status }), page: String(page) });
    for (const [k, v] of Object.entries(over)) v === "" ? p.delete(k) : p.set(k, String(v));
    return `/leads?${p}`;
  };

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          Leads <span className="text-base font-normal text-slate-500">({count})</span>
        </h1>
        <a href="/api/leads/export" className="btn-secondary">
          ⬇ Export CSV
        </a>
      </div>

      <form className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-sm flex-1" name="q" defaultValue={q} placeholder="Search name, @username, email, phone, message…" />
        <select className="input w-auto" name="status" defaultValue={status}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button className="btn-primary">Filter</button>
        {(q || status) && (
          <Link href="/leads" className="btn-secondary">
            Clear
          </Link>
        )}
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={qs({ status: "", page: 1 })} className={`rounded-full border px-3 py-1 text-xs ${!status ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white"}`}>
          All
        </Link>
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={qs({ status: s.value, page: 1 })}
            className={`rounded-full border px-3 py-1 text-xs ${status === s.value ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white"}`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Last message</th>
              <th className="px-4 py-3">Source / Tags</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Aayi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  Koi lead nahi mili.
                </td>
              </tr>
            )}
            {leads.map((l) => {
              const tags = parseJson<string[]>(l.tags, []);
              return (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${l.id}`} className="flex items-center gap-3">
                      <Avatar src={l.profilePic} name={l.name} />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 hover:text-indigo-600">{l.name ?? "Unknown"}</div>
                        <div className="text-xs text-slate-500">{l.igUsername ? `@${l.igUsername}` : `ID ${l.subscriberId}`}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <div>{l.phone ?? "—"}</div>
                    <div>{l.email ?? ""}</div>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-slate-600">
                    <div className="line-clamp-2">{l.lastInputText ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="text-slate-700">{l.source ?? ""}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tags.slice(0, 3).map((t) => (
                        <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                          {t}
                        </span>
                      ))}
                      {tags.length > 3 && <span className="text-slate-400">+{tags.length - 3}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {l.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link href={qs({ page: page - 1 })} className="btn-secondary">
              ← Prev
            </Link>
          )}
          <span className="text-slate-500">
            Page {page} / {pages}
          </span>
          {page < pages && (
            <Link href={qs({ page: page + 1 })} className="btn-secondary">
              Next →
            </Link>
          )}
        </div>
      )}
    </AppShell>
  );
}
