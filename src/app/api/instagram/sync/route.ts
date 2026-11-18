import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { runInstagramSync } from "@/lib/instagramSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * CRM ke "Instagram se import" button se call hota hai (login zaroori — middleware).
 * Body: { mode: "new" | "full", cursor?: string, startedAt?: number }
 * Response me done=false ho to same cursor ke saath dobara call karo.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { mode?: string; cursor?: string | null; startedAt?: number | null };
  try {
    const result = await runInstagramSync({
      mode: body.mode === "full" ? "full" : "new",
      cursor: body.cursor ?? null,
      startedAt: body.startedAt ?? null,
      budgetMs: 30000,
    });
    if (result.done) {
      revalidatePath("/leads");
      revalidatePath("/");
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[instagram sync]", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
