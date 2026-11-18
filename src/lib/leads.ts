import { Prisma } from "@prisma/client";
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
  /**
   * "webhook" = ManyChat se aayi request
   * "sync"    = CRM se manual refresh (raw payload overwrite nahi hota, SYNC activity)
   * "enrich"  = webhook ke baad background me API se profile bharna (activity sirf error par)
   */
  mode?: "webhook" | "sync" | "enrich";
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

  const bySubscriber = await prisma.lead.findUnique({ where: { subscriberId } });
  // Instagram DM import se bani lead (subscriberId "ig:...") ho to usi ko ManyChat id de do — duplicate nahi
  const igOnly =
    !bySubscriber && (fields.igUsername || fields.igId)
      ? await prisma.lead.findFirst({
          where: {
            subscriberId: { startsWith: "ig:" },
            OR: [
              ...(fields.igUsername ? [{ igUsername: { equals: fields.igUsername, mode: Prisma.QueryMode.insensitive } }] : []),
              ...(fields.igId ? [{ igId: fields.igId }] : []),
            ],
          },
        })
      : null;
  const existing = bySubscriber ?? igOnly;

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
    ...(mode === "webhook" ? { rawPayload: JSON.stringify(payload).slice(0, 20000), lastWebhookAt: new Date() } : {}),
    ...(source?.trim() ? { source: source.trim() } : {}),
  };

  // upsert: agar same user ki 2 requests ek saath aayein (comment + DM), dono safe save hongi
  let lead;
  if (igOnly) {
    lead = await prisma.lead.update({ where: { id: igOnly.id }, data: { subscriberId, ...data } });
  } else try {
    lead = await prisma.lead.upsert({ where: { subscriberId }, create: { subscriberId, ...data }, update: data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      lead = await prisma.lead.update({ where: { subscriberId }, data });
    } else {
      throw e;
    }
  }

  if (mode === "enrich") {
    if (apiError) {
      await prisma.activity.create({ data: { leadId: lead.id, type: "SYNC", message: `ManyChat API fetch fail: ${apiError}` } });
    }
  } else if (mode === "sync") {
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

/** Webhook ka response bhejne ke baad ManyChat API se poori profile (photo, tags, custom fields) bharta hai */
export function enrichLeadFromManyChat(subscriberId: string) {
  return upsertLeadFromManyChat({ subscriberId, payload: { id: subscriberId }, mode: "enrich" });
}
