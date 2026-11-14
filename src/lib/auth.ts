// Edge (middleware) aur Node dono me chalne wala simple password session.
export const SESSION_COOKIE = "crm_session";

async function hmac(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Password badalne par purane sessions apne aap invalid ho jaate hain. */
export async function expectedSessionToken() {
  const secret = process.env.AUTH_SECRET;
  const password = process.env.CRM_PASSWORD;
  if (!secret || !password) return null;
  return hmac(secret, `crm-session:${password}`);
}

export async function isValidSession(token: string | undefined) {
  if (!token) return false;
  const expected = await expectedSessionToken();
  if (!expected || token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
