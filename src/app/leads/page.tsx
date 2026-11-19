import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STATUSES } from "@/lib/statuses";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, RANGE_PRESETS, parseLeadFilters } from "@/lib/leadFilters";
import { parseJson } from "@/lib/leads";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar } from "@/components/Avatar";
import { fmtIST } from "@/lib/time";

export const dynamic = "force-dynamic";

/** 1 … 4 5 [6] 7 8 … 20 — page numbers with gaps */
function pageList(page: number, pages: number): (number | "gap")[] {
  const set = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter((n) => n >= 1 && n <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const f = parseLeadFilters(await searchParams);
  const { q, status, range, size, where } = f;

  const count = await prisma.lead.count({ where });
  const pages = Math.max(1, Math.ceil(count / size));
  const page = Math.min(f.page, pages);
  // Jo lead sabse last aayi (nayi ya wapas aane wali) wo sabse upar
  const leads = await prisma.lead.findMany({
    where,
    orderBy: [{ lastWebhookAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    skip: (page - 1) * size,
    take: size,
  });
  const firstRow = count === 0 ? 0 : (page - 1) * size + 1;
  const lastRow = Math.min(page * size, count);

  const qs = (over: Record<string, string | number>) => {
    const p = new URLSearchParams({ ...f.params, page: String(page) });
    for (const [k, v] of Object.entries(over)) v === "" ? p.delete(k) : p.set(k, String(v));
    if (p.get("page") === "1") p.delete("page");
    return `/leads?${p}`;
  };
  const exportQs = new URLSearchParams(f.params);
  exportQs.delete("size");

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          Leads <span className="text-base font-normal text-slate-500">({count})</span>
        </h1>
        <a href={`/api/leads/export${exportQs.size ? `?${exportQs}` : ""}`} className="btn-secondary">
          ⬇ Export Excel{f.hasFilters ? " (filtered)" : ""}
        </a>
      </div>

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-3">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs text-slate-500">
          Search
          <input className="input" name="q" defaultValue={q} placeholder="Name, @username, email, phone, message…" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Status
          <select className="input w-auto" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Date
          <select className="input w-auto" name="range" defaultValue={range}>
            <option value="">Any time / Custom</option>
            {RANGE_PRESETS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          From (IST)
          <input className="input w-auto" type="datetime-local" name="from" defaultValue={f.from} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          To (IST)
          <input className="input w-auto" type="datetime-local" name="to" defaultValue={f.to} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Per page
          <select className="input w-auto" name="size" defaultValue={String(size)}>
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button className="btn-primary">Filter</button>
          {f.hasFilters && (
            <Link href={size === DEFAULT_PAGE_SIZE ? "/leads" : `/leads?size=${size}`} className="btn-secondary">
              Clear
            </Link>
          )}
        </div>
        <p className="w-full text-xs text-slate-400">
          Date filter lead ke last aane ke time (IST) par lagta hai. Custom From/To ke liye Date me &quot;Any time / Custom&quot; rakho.
        </p>
      </form>

      <div className="mb-2 flex flex-wrap gap-2">
        <Link href={qs({ range: "", from: "", to: "", page: 1 })} className={`rounded-full border px-3 py-1 text-xs ${!f.hasDateFilter ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white"}`}>
          Any time
        </Link>
        {RANGE_PRESETS.map((r) => (
          <Link
            key={r.value}
            href={qs({ range: r.value, from: "", to: "", page: 1 })}
            className={`rounded-full border px-3 py-1 text-xs ${range === r.value ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white"}`}
          >
            {r.label}
          </Link>
        ))}
      </div>

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
              <th className="px-4 py-3">Aayi (IST)</th>
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
                    <div>{fmtIST(l.lastWebhookAt ?? l.createdAt)}</div>
                    {l.lastWebhookAt && l.lastWebhookAt.getTime() - l.createdAt.getTime() > 60000 && (
                      <div className="text-slate-400">Pehli baar: {fmtIST(l.createdAt)}</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-slate-500">
          Showing {firstRow}–{lastRow} of {count}
        </span>
        {pages > 1 && (
          <nav className="flex flex-wrap items-center gap-1">
            {page > 1 ? (
              <Link href={qs({ page: page - 1 })} className="btn-secondary">
                ← Prev
              </Link>
            ) : (
              <span className="btn-secondary pointer-events-none opacity-40">← Prev</span>
            )}
            {pageList(page, pages).map((n, i) =>
              n === "gap" ? (
                <span key={`gap-${i}`} className="px-1 text-slate-400">
                  …
                </span>
              ) : (
                <Link
                  key={n}
                  href={qs({ page: n })}
                  aria-current={n === page ? "page" : undefined}
                  className={`min-w-9 rounded-md border px-3 py-1.5 text-center ${n === page ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
                >
                  {n}
                </Link>
              )
            )}
            {page < pages ? (
              <Link href={qs({ page: page + 1 })} className="btn-secondary">
                Next →
              </Link>
            ) : (
              <span className="btn-secondary pointer-events-none opacity-40">Next →</span>
            )}
          </nav>
        )}
      </div>
    </AppShell>
  );
}
