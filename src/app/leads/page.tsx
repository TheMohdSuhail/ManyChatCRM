import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { STATUSES } from "@/lib/statuses";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, RANGE_PRESETS, parseLeadFilters } from "@/lib/leadFilters";
import { parseJson } from "@/lib/leads";
import { AppShell, PageHeader } from "@/components/AppShell";
import { ChevronDown, ChevronLeft, ChevronRight, Clock, Download, Filter, Inbox, Phone, Search, X } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar } from "@/components/Avatar";
import { fmtIST } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads" };

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

  const advancedOpen = Boolean(f.from || f.to || size !== DEFAULT_PAGE_SIZE);

  return (
    <AppShell>
      <PageHeader
        title={
          <>
            Leads <span className="text-lg font-normal text-slate-400">{count}</span>
          </>
        }
        actions={
          <a href={`/api/leads/export${exportQs.size ? `?${exportQs}` : ""}`} className="btn-secondary">
            <Download className="h-4 w-4" /> Export Excel{f.hasFilters ? " (filtered)" : ""}
          </a>
        }
      />

      <form className="card mb-4 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" name="q" defaultValue={q} placeholder="Name, @username, email, phone, message…" type="search" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <select className="input sm:w-40" name="status" defaultValue={status} aria-label="Status">
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <select className="input sm:w-44" name="range" defaultValue={range} aria-label="Date">
              <option value="">Any time / Custom</option>
              {RANGE_PRESETS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary flex-1 sm:flex-none">
              <Filter className="h-4 w-4" /> Filter
            </button>
            {f.hasFilters && (
              <Link href={size === DEFAULT_PAGE_SIZE ? "/leads" : `/leads?size=${size}`} className="btn-secondary flex-1 sm:flex-none">
                <X className="h-4 w-4" /> Clear
              </Link>
            )}
          </div>
        </div>
        <details className="group mt-2" open={advancedOpen}>
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-slate-500 select-none hover:text-slate-800 [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" /> Custom date &amp; per page
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="label">From (IST)</span>
              <input className="input" type="datetime-local" name="from" defaultValue={f.from} />
            </label>
            <label className="block">
              <span className="label">To (IST)</span>
              <input className="input" type="datetime-local" name="to" defaultValue={f.to} />
            </label>
            <label className="block">
              <span className="label">Per page</span>
              <select className="input" name="size" defaultValue={String(size)}>
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Date filter lead ke last aane ke time (IST) par lagta hai. Custom From/To ke liye Date me &quot;Any time / Custom&quot; rakho.
          </p>
        </details>
      </form>

      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <Link href={qs({ range: "", from: "", to: "", page: 1 })} className={`chip ${!f.hasDateFilter ? "chip-on" : "chip-off"}`}>
          Any time
        </Link>
        {RANGE_PRESETS.map((r) => (
          <Link key={r.value} href={qs({ range: r.value, from: "", to: "", page: 1 })} className={`chip ${range === r.value ? "chip-on" : "chip-off"}`}>
            {r.label}
          </Link>
        ))}
      </div>

      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <Link href={qs({ status: "", page: 1 })} className={`chip ${!status ? "chip-on" : "chip-off"}`}>
          All
        </Link>
        {STATUSES.map((s) => (
          <Link key={s.value} href={qs({ status: s.value, page: 1 })} className={`chip ${status === s.value ? "chip-on" : "chip-off"}`}>
            {s.label}
          </Link>
        ))}
      </div>

      {leads.length === 0 ? (
        <div className="card flex flex-col items-center px-4 py-14 text-center">
          <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">
            <Inbox className="h-6 w-6" />
          </span>
          <p className="font-medium">Koi lead nahi mili</p>
          <p className="mt-1 text-sm text-slate-500">{f.hasFilters ? "Filters badal ke dekho." : "ManyChat ya Instagram se leads aate hi yahan dikhengi."}</p>
        </div>
      ) : (
        <>
          {/* Mobile / tablet: cards */}
          <ul className="space-y-2 md:hidden">
            {leads.map((l) => {
              const tags = parseJson<string[]>(l.tags, []);
              return (
                <li key={l.id}>
                  <Link href={`/leads/${l.id}`} className="card block p-4 active:bg-slate-50">
                    <div className="flex items-start gap-3">
                      <Avatar src={l.profilePic} name={l.name} size={44} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{l.name ?? "Unknown"}</div>
                            <div className="truncate text-xs text-slate-500">{l.igUsername ? `@${l.igUsername}` : `ID ${l.subscriberId}`}</div>
                          </div>
                          <StatusBadge status={l.status} />
                        </div>
                        {l.lastInputText && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{l.lastInputText}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {fmtIST(l.lastWebhookAt ?? l.createdAt)}
                          </span>
                          {l.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {l.phone}
                            </span>
                          )}
                          {l.source && <span className="truncate">{l.source}</span>}
                        </div>
                        {tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {tags.slice(0, 3).map((t) => (
                              <span key={t} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                                {t}
                              </span>
                            ))}
                            {tags.length > 3 && <span className="text-[11px] text-slate-400">+{tags.length - 3}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Desktop: table */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-left text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Last message</th>
                  <th className="hidden px-4 py-3 xl:table-cell">Source / Tags</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Aayi (IST)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((l) => {
                  const tags = parseJson<string[]>(l.tags, []);
                  return (
                    <tr key={l.id} className="group hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <Link href={`/leads/${l.id}`} className="flex items-center gap-3">
                          <Avatar src={l.profilePic} name={l.name} />
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 group-hover:text-indigo-600">{l.name ?? "Unknown"}</div>
                            <div className="text-xs text-slate-500">{l.igUsername ? `@${l.igUsername}` : `ID ${l.subscriberId}`}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div>{l.phone ?? "—"}</div>
                        <div className="max-w-[180px] truncate">{l.email ?? ""}</div>
                      </td>
                      <td className="hidden max-w-xs px-4 py-3 text-xs text-slate-600 lg:table-cell">
                        <div className="line-clamp-2">{l.lastInputText ?? "—"}</div>
                      </td>
                      <td className="hidden px-4 py-3 text-xs xl:table-cell">
                        <div className="text-slate-700">{l.source ?? ""}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {tags.slice(0, 3).map((t) => (
                            <span key={t} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600">
                              {t}
                            </span>
                          ))}
                          {tags.length > 3 && <span className="text-slate-400">+{tags.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={l.status} />
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-500">
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
        </>
      )}

      <div className="mt-4 flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
        <span className="text-slate-500">
          Showing {firstRow}–{lastRow} of {count}
        </span>
        {pages > 1 && (
          <nav className="flex items-center gap-1" aria-label="Pagination">
            {page > 1 ? (
              <Link href={qs({ page: page - 1 })} className="btn-secondary px-2.5" aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Prev</span>
              </Link>
            ) : (
              <span className="btn-secondary pointer-events-none px-2.5 opacity-40">
                <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Prev</span>
              </span>
            )}
            <span className="px-3 text-slate-600 sm:hidden">
              {page} / {pages}
            </span>
            <div className="hidden items-center gap-1 sm:flex">
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
                    className={`grid h-9 min-w-9 place-items-center rounded-xl border px-2 ${
                      n === page ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {n}
                  </Link>
                )
              )}
            </div>
            {page < pages ? (
              <Link href={qs({ page: page + 1 })} className="btn-secondary px-2.5" aria-label="Next page">
                <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="btn-secondary pointer-events-none px-2.5 opacity-40">
                <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </nav>
        )}
      </div>
    </AppShell>
  );
}
