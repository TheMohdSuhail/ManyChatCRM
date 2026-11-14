import { prisma } from "@/lib/prisma";
import { statusMeta } from "@/lib/statuses";
import { parseJson } from "@/lib/leads";

export const dynamic = "force-dynamic";

function csvCell(v: unknown) {
  let s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  // Excel formula injection se bachav (phone numbers jaise "+91..." ko chhod ke)
  if (/^[=+\-@\t\r]/.test(s) && !/^\+?[\d\s()-]+$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });
  const header = [
    "Name", "Instagram", "Email", "Phone", "Status", "Source", "Deal Value", "Follow-up",
    "Last Message", "Tags", "ManyChat ID", "Created",
  ];
  const rows = leads.map((l) => [
    l.name, l.igUsername ? `https://instagram.com/${l.igUsername}` : "", l.email, l.phone, statusMeta(l.status).label, l.source,
    l.dealValue, l.followUpAt, l.lastInputText, parseJson<string[]>(l.tags, []).join("; "), l.subscriberId, l.createdAt,
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
