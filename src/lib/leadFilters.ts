import type { Prisma } from "@prisma/client";
import { isValidStatus } from "./statuses";
import { fromISTInput, startOfISTDay, toISTInput } from "./time";

const DAY_MS = 24 * 60 * 60 * 1000;

export const RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
] as const;

export const PAGE_SIZES = [25, 50, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 50;

type RawParams = Record<string, string | string[] | undefined>;

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

/** Preset (today / 7d ...) ko IST ke hisaab se [from, to) Date range me badalta hai */
function presetRange(range: string, now = new Date()): { from: Date; to: Date } | null {
  const today = startOfISTDay(now);
  switch (range) {
    case "today":
      return { from: today, to: new Date(today.getTime() + DAY_MS) };
    case "yesterday":
      return { from: new Date(today.getTime() - DAY_MS), to: today };
    case "7d":
      return { from: new Date(today.getTime() - 6 * DAY_MS), to: new Date(today.getTime() + DAY_MS) };
    case "30d":
      return { from: new Date(today.getTime() - 29 * DAY_MS), to: new Date(today.getTime() + DAY_MS) };
    case "month": {
      // IST date ka 1 tarikh, raat 12 baje IST
      const key = toISTInput(now).slice(0, 7); // "2026-11"
      const from = fromISTInput(`${key}-01T00:00`)!;
      return { from, to: new Date(today.getTime() + DAY_MS) };
    }
    default:
      return null;
  }
}

/**
 * URL search params se leads ka filter banata hai — Leads page aur Excel export dono yahi use karte hain.
 * Date filter "Aayi" time par lagta hai: lastWebhookAt (last aayi), warna createdAt.
 */
export function parseLeadFilters(sp: RawParams) {
  const q = str(sp.q);
  const status = isValidStatus(str(sp.status)) ? str(sp.status) : "";
  const range = RANGE_PRESETS.some((r) => r.value === str(sp.range)) ? str(sp.range) : "";

  // Custom from/to (datetime-local, IST). Sirf date diya ho to "to" poore din tak maana jata hai.
  let fromStr = str(sp.from);
  let toStr = str(sp.to);
  let from: Date | null = null;
  let to: Date | null = null;
  const preset = range ? presetRange(range) : null;
  if (preset) {
    ({ from, to } = preset);
    fromStr = "";
    toStr = "";
  } else {
    if (fromStr) from = fromISTInput(/T/.test(fromStr) ? fromStr : `${fromStr}T00:00`);
    if (toStr) {
      if (/T/.test(toStr)) {
        const t = fromISTInput(toStr);
        to = t ? new Date(t.getTime() + 60 * 1000) : null; // us minute ko include karo
      } else {
        const t = fromISTInput(`${toStr}T00:00`);
        to = t ? new Date(t.getTime() + DAY_MS) : null;
      }
    }
    if (!from) fromStr = "";
    if (!to) toStr = "";
  }

  const sizeNum = Number(str(sp.size));
  const size = (PAGE_SIZES as readonly number[]).includes(sizeNum) ? sizeNum : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Math.floor(Number(str(sp.page))) || 1);

  const and: Prisma.LeadWhereInput[] = [];
  if (status) and.push({ status });
  if (q) {
    // mode: "insensitive" — Postgres me search warna capital/small letter par miss ho jata tha
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { igUsername: { contains: q.replace(/^@/, ""), mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { source: { contains: q, mode: "insensitive" } },
        { lastInputText: { contains: q, mode: "insensitive" } },
        { subscriberId: q },
      ],
    });
  }
  if (from || to) {
    const between = { ...(from && { gte: from }), ...(to && { lt: to }) };
    and.push({
      OR: [{ lastWebhookAt: between }, { lastWebhookAt: null, createdAt: between }],
    });
  }

  const where: Prisma.LeadWhereInput = and.length ? { AND: and } : {};

  /** Filters ko URL me wapas likhne ke liye (page/size ke saath) */
  const params: Record<string, string> = {
    ...(q && { q }),
    ...(status && { status }),
    ...(range && { range }),
    ...(fromStr && { from: fromStr }),
    ...(toStr && { to: toStr }),
    ...(size !== DEFAULT_PAGE_SIZE && { size: String(size) }),
  };

  return {
    q, status, range, from: fromStr, to: toStr, size, page, where, params,
    hasFilters: Boolean(q || status || range || fromStr || toStr),
    hasDateFilter: Boolean(from || to),
  };
}
