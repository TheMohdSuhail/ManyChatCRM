import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { upsertLeadFromManyChat } from "@/lib/leads";
import { statusMeta } from "@/lib/statuses";

export const dynamic = "force-dynamic";

function secretOk(req: NextRequest) {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) return false;
  const got = req.headers.get("x-webhook-secret") ?? req.nextUrl.searchParams.get("secret") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * ManyChat Flow -> Action -> External Request (POST) yaha aata hai.
 * Body example:
 * {
 *   "subscriber_id": "{{user_id}}",
 *   "name": "{{full_name}}",
 *   "ig_username": "{{ig_username}}",
 *   "email": "{{email}}",
 *   "phone": "{{phone}}",
 *   "message": "{{last_input_text}}",
 *   "source": "Reel - Free Guide"
 * }
 */
export async function POST(req: NextRequest) {
  if (!secretOk(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const rawId = body.subscriber_id ?? body.user_id ?? body.contact_id ?? body.id;
  const subscriberId = rawId === undefined || rawId === null ? "" : String(rawId).trim();
  if (!subscriberId || /^\{\{.*\}\}$/.test(subscriberId)) {
    return NextResponse.json({ ok: false, error: "subscriber_id missing" }, { status: 400 });
  }

  try {
    const { lead, created } = await upsertLeadFromManyChat({
      subscriberId,
      payload: { ...body, id: subscriberId },
      source: typeof body.source === "string" ? body.source : null,
      message: typeof body.message === "string" ? body.message : null,
    });

    // Ye response ManyChat me "Response mapping" se custom field me save kar sakte ho
    return NextResponse.json({
      ok: true,
      created,
      lead_id: lead.id,
      status: lead.status,
      status_label: statusMeta(lead.status).label,
    });
  } catch (e) {
    console.error("[manychat webhook]", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "ManyChat webhook live hai. POST request bhejo." });
}
