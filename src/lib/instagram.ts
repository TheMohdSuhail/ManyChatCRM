// Instagram API with Instagram Login — Conversations API
// Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/conversations-api
// Token: Meta App Dashboard -> Instagram -> "API setup with Instagram login" -> Generate token
// Permissions: instagram_business_basic, instagram_business_manage_messages

import { getSetting, setSetting } from "./settings";

const GRAPH = "https://graph.instagram.com/v24.0";
const DAY = 86400000;

export const IG_TOKEN_KEY = "ig_token";
const IG_TOKEN_REFRESHED_KEY = "ig_token_refreshed_at";

export type IgUser = { id: string; username?: string };
export type IgMessage = {
  id: string;
  created_time: string | number;
  from?: IgUser;
  to?: { data?: IgUser[] };
  message?: string;
};
export type IgConversation = {
  id: string;
  updated_time?: string | number;
  participants?: { data?: IgUser[] };
  messages?: { data?: IgMessage[] };
};
type Paged<T> = { data: T[]; paging?: { cursors?: { after?: string }; next?: string } };

export async function hasIgToken() {
  return Boolean((await getSetting(IG_TOKEN_KEY)) ?? process.env.IG_ACCESS_TOKEN);
}

/**
 * Token DB (Setup page se save) ya .env IG_ACCESS_TOKEN se.
 * Long-lived token 60 din chalta hai — har 7 din me apne aap refresh ho jata hai.
 */
async function getIgToken(): Promise<string> {
  const token = (await getSetting(IG_TOKEN_KEY)) ?? process.env.IG_ACCESS_TOKEN;
  if (!token) throw new Error("Instagram token set nahi hai — ManyChat Setup page par Instagram token daalo");

  const refreshedAt = Number((await getSetting(IG_TOKEN_REFRESHED_KEY)) ?? 0);
  if (Date.now() - refreshedAt > 7 * DAY) {
    try {
      const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`;
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      const json = (await res.json()) as { access_token?: string };
      if (res.ok && json.access_token) {
        await setSetting(IG_TOKEN_KEY, json.access_token);
        await setSetting(IG_TOKEN_REFRESHED_KEY, String(Date.now()));
        return json.access_token;
      }
      throw new Error(JSON.stringify(json).slice(0, 300));
    } catch (e) {
      // Naya token (24 ghante se kam purana) refresh nahi hota — kal dobara try
      console.warn("[instagram] token refresh fail (kal dobara try hoga):", e instanceof Error ? e.message : e);
      await setSetting(IG_TOKEN_REFRESHED_KEY, String(Date.now() - 6 * DAY));
    }
  }
  return token;
}

async function igGet<T>(path: string, params: Record<string, string | undefined> = {}, tokenOverride?: string): Promise<T> {
  const token = tokenOverride ?? (await getIgToken());
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, v);
  qs.set("access_token", token);

  const res = await fetch(`${GRAPH}${path}?${qs}`, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string; code?: number } }) | null;
  if (!res.ok || !json || json.error) {
    const msg = json?.error?.message ?? res.statusText;
    throw new Error(`Instagram API error (${res.status}): ${msg}`);
  }
  return json;
}

/** Hamara (Herbal Maza) Instagram account */
export function getIgAccount(tokenOverride?: string) {
  return igGet<{ id: string; user_id?: string; username?: string; name?: string }>(
    "/me",
    { fields: "id,user_id,username,name" },
    tokenOverride
  );
}

const MSG_FIELDS = "id,created_time,from,to,message";
const CONV_FIELDS = `id,updated_time,participants,messages.limit(20){${MSG_FIELDS}}`;

/** Saari DM conversations, latest pehle. `after` = pichle page ka cursor */
export function listConversations(after?: string, limit = 20) {
  return igGet<Paged<IgConversation>>("/me/conversations", {
    platform: "instagram",
    fields: CONV_FIELDS,
    limit: String(limit),
    after,
  });
}

export function getConversation(conversationId: string) {
  return igGet<IgConversation>(`/${encodeURIComponent(conversationId)}`, { fields: CONV_FIELDS });
}

/** IGSID (user ka Instagram-scoped id) se uski conversation */
export async function findConversationByUser(igsid: string) {
  const r = await igGet<Paged<{ id: string }>>("/me/conversations", { platform: "instagram", user_id: igsid });
  return r.data[0]?.id ?? null;
}

export function getMessage(messageId: string) {
  return igGet<IgMessage>(`/${encodeURIComponent(messageId)}`, { fields: MSG_FIELDS });
}

/** Instagram time: UNIX seconds ya "2022-07-12T19:11:07+0000" */
export function parseIgTime(v: string | number | undefined | null): Date | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number" || /^\d+$/.test(v)) {
    const n = Number(v);
    return new Date(n < 1e12 ? n * 1000 : n);
  }
  const d = new Date(String(v).replace(/([+-]\d\d)(\d\d)$/, "$1:$2"));
  return isNaN(d.getTime()) ? null : d;
}
