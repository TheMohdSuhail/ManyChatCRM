// ManyChat Page API — spec: https://api.manychat.com/swagger
// Auth: "Authorization: Bearer <token>" (ManyChat -> Settings -> API -> Generate API Key)

const BASE_URL = "https://api.manychat.com";

export type ManyChatSubscriber = {
  id: string;
  page_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  gender?: string | null;
  profile_pic?: string | null;
  locale?: string | null;
  language?: string | null;
  timezone?: string | null;
  live_chat_url?: string | null;
  last_input_text?: string | null;
  phone?: string | null;
  email?: string | null;
  subscribed?: string | null;
  last_interaction?: string | null;
  ig_last_interaction?: string | null;
  ig_username?: string | null;
  ig_id?: number | string | null;
  custom_fields?: { id: number; name: string; type: string; value: unknown }[] | Record<string, unknown>;
  tags?: { id: number; name: string }[];
};

export function isManyChatConfigured() {
  return Boolean(process.env.MANYCHAT_API_TOKEN);
}

async function mcFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.MANYCHAT_API_TOKEN;
  if (!token) throw new Error("MANYCHAT_API_TOKEN set nahi hai (.env)");

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init?.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });

  const json = (await res.json().catch(() => null)) as { status?: string; data?: T; message?: string } | null;
  if (!res.ok || !json || json.status !== "success") {
    throw new Error(`ManyChat API error (${res.status}): ${json?.message ?? res.statusText}`);
  }
  return json.data as T;
}

/** GET /fb/subscriber/getInfo — limit 10 req/sec */
export function getSubscriberInfo(subscriberId: string | number) {
  return mcFetch<ManyChatSubscriber>(
    `/fb/subscriber/getInfo?subscriber_id=${encodeURIComponent(String(subscriberId))}`
  );
}

/** POST /fb/subscriber/addTagByName — CRM se ManyChat me tag lagane ke liye */
export function addTagByName(subscriberId: string | number, tagName: string) {
  return mcFetch<unknown>("/fb/subscriber/addTagByName", {
    method: "POST",
    body: JSON.stringify({ subscriber_id: Number(subscriberId), tag_name: tagName }),
  });
}

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  // ManyChat khali variable ko kabhi kabhi literal "{{...}}" ya "" bhej deta hai
  if (!s || /^\{\{.*\}\}$/.test(s)) return null;
  return s;
}

function date(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeCustomFields(cf: ManyChatSubscriber["custom_fields"]): Record<string, unknown> {
  if (!cf) return {};
  if (Array.isArray(cf)) {
    const out: Record<string, unknown> = {};
    for (const f of cf) if (f?.name && f.value !== null && f.value !== undefined && f.value !== "") out[f.name] = f.value;
    return out;
  }
  return Object.fromEntries(Object.entries(cf).filter(([, v]) => v !== null && v !== undefined && v !== ""));
}

/** ManyChat subscriber object (API ya webhook) -> Lead table ke fields. Sirf non-empty values return karta hai. */
export function subscriberToLeadFields(sub: Partial<ManyChatSubscriber>) {
  const fields = {
    pageId: str(sub.page_id),
    name: str(sub.name) ?? ([str(sub.first_name), str(sub.last_name)].filter(Boolean).join(" ") || null),
    firstName: str(sub.first_name),
    lastName: str(sub.last_name),
    igUsername: str(sub.ig_username)?.replace(/^@/, "") ?? null,
    igId: str(sub.ig_id),
    email: str(sub.email),
    phone: str(sub.phone),
    profilePic: str(sub.profile_pic),
    gender: str(sub.gender),
    locale: str(sub.locale),
    timezone: str(sub.timezone),
    lastInputText: str(sub.last_input_text),
    liveChatUrl: str(sub.live_chat_url),
    subscribedAt: date(sub.subscribed),
    lastInteractionAt: date(sub.ig_last_interaction) ?? date(sub.last_interaction),
  };
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null)) as Partial<typeof fields>;
  const tags = Array.isArray(sub.tags) ? sub.tags.map((t) => t?.name).filter(Boolean) : undefined;
  const customFields = sub.custom_fields ? normalizeCustomFields(sub.custom_fields) : undefined;
  return { fields: clean, tags, customFields };
}
