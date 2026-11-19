import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { statusMeta } from "@/lib/statuses";
import { parseJson } from "@/lib/leads";
import { istDayKey } from "@/lib/time";
import { parseLeadFilters } from "@/lib/leadFilters";
import { getCurrentUser } from "@/lib/users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IST_OFFSET_MS = 330 * 60 * 1000;

/** Excel me timezone nahi hota — IST wall-clock time dikhane ke liye date ko +05:30 shift karte hain */
const istCell = (d: Date | null) => (d ? new Date(d.getTime() + IST_OFFSET_MS) : null);

/** Excel formula injection se bachav (phone numbers jaise "+91..." ko chhod ke) */
function safeText(v: string | null | undefined) {
  if (!v) return "";
  return /^[=+\-@\t\r]/.test(v) && !/^\+?[\d\s()-]+$/.test(v) ? `'${v}` : v;
}

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  // Leads page wale hi filters (search, status, date range) — page/size nahi, saari matching leads
  const { where } = parseLeadFilters(Object.fromEntries(new URL(req.url).searchParams));
  const leads = await prisma.lead.findMany({
    where,
    orderBy: [{ lastWebhookAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });

  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const ws = wb.addWorksheet("Leads", { views: [{ state: "frozen", ySplit: 1 }] });

  const dateFmt = "dd-mmm-yyyy hh:mm AM/PM";
  ws.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Instagram", key: "instagram", width: 24 },
    { header: "Email", key: "email", width: 28 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Status", key: "status", width: 14 },
    { header: "Source", key: "source", width: 18 },
    { header: "Deal Value", key: "dealValue", width: 12, style: { numFmt: "#,##0.00" } },
    { header: "Follow-up (IST)", key: "followUpAt", width: 20, style: { numFmt: dateFmt } },
    { header: "Last Message", key: "lastMessage", width: 45, style: { alignment: { wrapText: true, vertical: "top" } } },
    { header: "Tags", key: "tags", width: 28 },
    { header: "ManyChat ID", key: "subscriberId", width: 18 },
    { header: "First Came (IST)", key: "createdAt", width: 20, style: { numFmt: dateFmt } },
    { header: "Last Came (IST)", key: "lastWebhookAt", width: 20, style: { numFmt: dateFmt } },
  ];

  for (const l of leads) {
    const row = ws.addRow({
      name: safeText(l.name),
      instagram: l.igUsername ? `@${l.igUsername}` : "",
      email: safeText(l.email),
      phone: l.phone ?? "",
      status: statusMeta(l.status).label,
      source: safeText(l.source),
      dealValue: l.dealValue,
      followUpAt: istCell(l.followUpAt),
      lastMessage: safeText(l.lastInputText),
      tags: parseJson<string[]>(l.tags, []).join(", "),
      subscriberId: l.subscriberId,
      createdAt: istCell(l.createdAt),
      lastWebhookAt: istCell(l.lastWebhookAt),
    });
    if (l.igUsername) {
      const cell = row.getCell("instagram");
      cell.value = { text: `@${l.igUsername}`, hyperlink: `https://instagram.com/${l.igUsername}` };
      cell.font = { color: { argb: "FF4F46E5" }, underline: true };
    }
  }

  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  header.alignment = { vertical: "middle" };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="leads-${istDayKey(new Date())}.xlsx"`,
    },
  });
}
