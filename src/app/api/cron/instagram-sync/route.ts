import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runInstagramSync } from "@/lib/instagramSync";
import { hasIgToken } from "@/lib/instagram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  // Vercel Cron "Authorization: Bearer <CRON_SECRET>" bhejta hai; cron-job.org jaise tools ?secret= bhi use kar sakte hain
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.nextUrl.searchParams.get("secret") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Automatic sync: sirf nayi Instagram chats (pichle sync ke baad wali) CRM me laata hai */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!(await hasIgToken())) return NextResponse.json({ ok: false, error: "Instagram token set nahi hai" }, { status: 400 });

  try {
    let cursor: string | null = null;
    let startedAt: number | null = null;
    const t0 = Date.now();
    const total = { conversations: 0, newLeads: 0, updatedLeads: 0, newMessages: 0, errors: 0 };
    for (;;) {
      const r = await runInstagramSync({ mode: "new", cursor, startedAt, budgetMs: 20000 });
      total.conversations += r.stats.conversations;
      total.newLeads += r.stats.newLeads;
      total.updatedLeads += r.stats.updatedLeads;
      total.newMessages += r.stats.newMessages;
      total.errors += r.stats.errors.length;
      if (r.done || Date.now() - t0 > 40000) return NextResponse.json({ ok: true, done: r.done, ...total });
      cursor = r.cursor;
      startedAt = r.startedAt;
    }
  } catch (e) {
    console.error("[instagram cron]", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
