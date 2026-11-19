// Signed session cookie — Edge (middleware) aur Node dono me chalta hai (sirf Web Crypto).
// Format: base64url(JSON payload) + "." + hex HMAC-SHA256(AUTH_SECRET)
export const SESSION_COOKIE = "crm_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 din

export type SessionPayload = {
  /** user id */
  u: string;
  /** user.sessionVersion — DB me badla to session invalid */
  v: number;
  /** expiry (unix seconds) */
  e: number;
};

const enc = new TextEncoder();

async function hmac(message: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function b64urlEncode(s: string) {
  let bin = "";
  for (const b of enc.encode(s)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(userId: string, version: number) {
  const payload: SessionPayload = { u: userId, v: version, e: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = await hmac(body);
  if (!sig) throw new Error("AUTH_SECRET set nahi hai");
  return `${body}.${sig}`;
}

/** Signature + expiry check. DB check (user exist / version) server side `getCurrentUser` me hota hai. */
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(body);
  if (!expected || !safeEqual(sig, expected)) return null;
  try {
    const p = JSON.parse(b64urlDecode(body)) as SessionPayload;
    if (typeof p.u !== "string" || typeof p.v !== "number" || typeof p.e !== "number") return null;
    if (p.e * 1000 < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
