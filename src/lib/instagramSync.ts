// Instagram DMs -> CRM leads + messages
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  findConversationByUser,
  getConversation,
  getIgAccount,
  getMessage,
  listConversations,
  parseIgTime,
  type IgConversation,
  type IgMessage,
  type IgUser,
} from "./instagram";
import { getSetting, setSetting } from "./settings";

export const IG_LAST_SYNC_KEY = "ig_last_sync_at";

export type SyncStats = {
  conversations: number;
  newLeads: number;
  updatedLeads: number;
  newMessages: number;
  skipped: number;
  errors: string[];
};

export const emptyStats = (): SyncStats => ({
  conversations: 0,
  newLeads: 0,
  updatedLeads: 0,
  newMessages: 0,
  skipped: 0,
  errors: [],
});

type Me = { ids: Set<string>; username: string | null };

async function loadMe(): Promise<Me> {
  const a = await getIgAccount();
  return {
    ids: new Set([a.id, a.user_id].filter((x): x is string => Boolean(x))),
    username: a.username?.toLowerCase() ?? null,
  };
}

function isMe(u: IgUser | undefined, me: Me) {
  if (!u) return false;
  return me.ids.has(u.id) || (Boolean(u.username) && u.username!.toLowerCase() === me.username);
}

/** Agar field expansion ne message details nahi diye to ek-ek fetch (Instagram sirf last 20 deta hai) */
async function messagesOf(conv: IgConversation): Promise<IgMessage[]> {
  const msgs = conv.messages?.data ?? [];
  if (msgs.length && msgs.every((m) => !m.from)) {
    const out: IgMessage[] = [];
    for (const m of msgs.slice(0, 10)) {
      try {
        out.push(await getMessage(m.id));
      } catch {
        /* purana message — Instagram "deleted" error deta hai */
      }
    }
    return out;
  }
  return msgs;
}

/** Ek conversation ko lead + messages me save karta hai */
export async function importConversation(conv: IgConversation, me: Me, stats: SyncStats) {
  const msgs = await messagesOf(conv);

  // Saamne wala banda (hamara account nahi)
  let other = conv.participants?.data?.find((p) => !isMe(p, me));
  if (!other) {
    for (const m of msgs) {
      if (m.from && !isMe(m.from, me)) {
        other = m.from;
        break;
      }
      const to = m.to?.data?.find((p) => !isMe(p, me));
      if (to) {
        other = to;
        break;
      }
    }
  }
  if (!other?.id) {
    stats.skipped++;
    return;
  }

  const parsed = msgs
    .map((m) => ({
      igMessageId: m.id,
      fromMe: isMe(m.from, me),
      text: m.message?.trim() || null,
      sentAt: parseIgTime(m.created_time),
    }))
    .filter((m): m is typeof m & { sentAt: Date } => m.sentAt !== null)
    .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());

  const incoming = parsed.filter((m) => !m.fromMe);
  const lastIncoming = incoming.at(-1);
  const lastActivity = lastIncoming?.sentAt ?? parsed.at(-1)?.sentAt ?? parseIgTime(conv.updated_time) ?? new Date();
  const username = other.username?.replace(/^@/, "") || null;

  // Pehle se CRM me hai? (ManyChat wali lead bhi username se match ho jayegi)
  let lead = await prisma.lead.findFirst({
    where: {
      OR: [
        { igConversationId: conv.id },
        { igId: other.id },
        ...(username ? [{ igUsername: { equals: username, mode: Prisma.QueryMode.insensitive } }] : []),
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  let created = false;
  if (!lead) {
    try {
      lead = await prisma.lead.create({
        data: {
          subscriberId: `ig:${other.id}`,
          igId: other.id,
          igUsername: username,
          name: username,
          igConversationId: conv.id,
          source: "Instagram DM",
          lastInputText: lastIncoming?.text ?? null,
          lastWebhookAt: lastActivity,
          // pehla message jab aaya tha wahi "aayi" time — taaki purani chats aaj ki leads me na gine
          createdAt: parsed[0]?.sentAt ?? lastActivity,
        },
      });
      created = true;
      stats.newLeads++;
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      lead = await prisma.lead.findUniqueOrThrow({ where: { subscriberId: `ig:${other.id}` } });
    }
  }

  const leadId = lead.id;
  if (!created) {
    const newer = lastIncoming && (!lead.lastWebhookAt || lastIncoming.sentAt > lead.lastWebhookAt) ? lastIncoming : null;
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        igConversationId: conv.id,
        ...(lead.igId ? {} : { igId: other.id }),
        ...(lead.igUsername || !username ? {} : { igUsername: username }),
        ...(newer ? { lastWebhookAt: newer.sentAt, ...(newer.text ? { lastInputText: newer.text } : {}) } : {}),
      },
    });
  }

  const { count } = parsed.length
    ? await prisma.message.createMany({
        data: parsed.map((m) => ({ ...m, leadId })),
        skipDuplicates: true,
      })
    : { count: 0 };
  stats.newMessages += count;

  if (created) {
    await prisma.activity.create({
      data: { leadId, type: "IMPORT", message: `Instagram DM se lead aayi (${count} messages import hue)` },
    });
  } else if (count > 0) {
    stats.updatedLeads++;
    await prisma.activity.create({
      data: { leadId, type: "IMPORT", message: `Instagram se ${count} naye messages sync hue` },
    });
  }
}

/**
 * Instagram DMs ko pages me import karta hai. Time budget khatam ho to cursor return karta hai —
 * client (ya cron) wahi cursor bhej ke aage continue karta hai. Isse Vercel timeout nahi hota.
 * mode "new"  = sirf pichle sync ke baad wali chats
 * mode "full" = saari chats
 */
export async function runInstagramSync(opts: {
  mode: "new" | "full";
  cursor?: string | null;
  startedAt?: number | null;
  budgetMs?: number;
}) {
  const t0 = Date.now();
  const startedAt = opts.startedAt ?? t0;
  const budgetMs = opts.budgetMs ?? 30000;
  const stats = emptyStats();
  const me = await loadMe();

  const lastSync = opts.mode === "new" ? Number((await getSetting(IG_LAST_SYNC_KEY)) ?? 0) : 0;
  const stopBefore = lastSync ? lastSync - 2 * 3600000 : 0; // 2 ghante ka margin

  let after = opts.cursor ?? undefined;
  let done = false;
  while (Date.now() - t0 < budgetMs) {
    const page = await listConversations(after, 10);
    let reachedOld = false;
    for (const conv of page.data) {
      const updated = parseIgTime(conv.updated_time)?.getTime() ?? Date.now();
      if (stopBefore && updated < stopBefore) {
        reachedOld = true;
        break;
      }
      stats.conversations++;
      try {
        await importConversation(conv, me, stats);
      } catch (e) {
        stats.errors.push(`${conv.id}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300));
      }
    }
    after = page.paging?.cursors?.after;
    if (reachedOld || !page.paging?.next || !after || page.data.length === 0) {
      done = true;
      break;
    }
  }

  if (done) await setSetting(IG_LAST_SYNC_KEY, String(startedAt));
  return { done, cursor: done ? null : (after ?? null), startedAt, stats };
}

/** Ek lead ki Instagram chat refresh */
export async function syncLeadInstagramChat(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  const convId = lead.igConversationId ?? (lead.igId ? await findConversationByUser(lead.igId) : null);
  if (!convId) throw new Error("Is lead ki Instagram chat nahi mili (Instagram ID/conversation pata nahi)");
  const stats = emptyStats();
  await importConversation(await getConversation(convId), await loadMe(), stats);
  return stats;
}

export async function lastInstagramSync() {
  const v = await getSetting(IG_LAST_SYNC_KEY);
  return v ? new Date(Number(v)) : null;
}
