import { prisma } from "./prisma";
import { getSubscriberInfo, isManyChatConfigured, subscriberToLeadFields, type ManyChatSubscriber } from "./manychat";

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * ManyChat se aayi lead ko save/update karta hai.
 * - webhook body ke fields pehle use hote hain
 * - agar MANYCHAT_API_TOKEN set hai to getInfo se poori profile (tags, custom fields, IG username...) merge hoti hai
 */
export async function upsertLeadFromManyChat(opts: {
  subscriberId: string;
  payload?: Partial<ManyChatSubscriber> & Record<string, unknown>;
  source?: string | null;
  message?: string | null;
  fetchFromApi?: boolean;
  /** "sync" = CRM se manual refresh (raw payload overwrite nahi hota, SYNC activity) */
  mode?: "webhook" | "sync";
}) {
  const { subscriberId, payload = {}, source, message, fetchFromApi = true, mode = "webhook" } = opts;

  let apiData: ManyChatSubscriber | null = null;
  let apiError: string | null = null;
  if (fetchFromApi && isManyChatConfigured()) {
    try {
      apiData = await getSubscriberInfo(subscriberId);
    } catch (e) {
      apiError = e instanceof Error ? e.message : String(e);
    }
  }

  const fromPayload = subscriberToLeadFields(payload);
  const fromApi = apiData ? subscriberToLeadFields(apiData) : null;

  const fields = { ...fromPayload.fields, ...(fromApi?.fields ?? {}) };
  if (message?.trim()) fields.lastInputText = message.trim();

  const existing = await prisma.lead.findUnique({ where: { subscriberId } });

  const tags = fromApi?.tags ?? fromPayload.tags;
  const customFields = {
    ...(existing ? parseJson<Record<string, unknown>>(existing.customFields, {}) : {}),
    ...(fromPayload.customFields ?? {}),
    ...(fromApi?.customFields ?? {}),
  };

  const data = {
    ...fields,
    ...(tags ? { tags: JSON.stringify(tags) } : {}),
    customFields: JSON.stringify(customFields),
    ...(mode === "webhook" ? { rawPayload: JSON.stringify(payload).slice(0, 20000) } : {}),
    ...(source?.trim() ? { source: source.trim() } : {}),
  };

  const lead = existing
    ? await prisma.lead.update({ where: { id: existing.id }, data })
    : await prisma.lead.create({ data: { subscriberId, ...data } });

  if (mode === "sync") {
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        type: "SYNC",
        message: apiError ? `Sync fail: ${apiError}` : "ManyChat se profile sync hui",
      },
    });
  } else {
    const parts = [existing ? "ManyChat se dobara aayi" : "Nayi lead ManyChat se aayi"];
    if (source?.trim()) parts.push(`source: ${source.trim()}`);
    if (message?.trim()) parts.push(`message: "${message.trim().slice(0, 200)}"`);
    if (apiError) parts.push(`(API fetch fail: ${apiError})`);
    await prisma.activity.create({
      data: { leadId: lead.id, type: existing ? "WEBHOOK" : "CREATED", message: parts.join(" · ") },
    });
  }

  return { lead, created: !existing, apiError };
}
