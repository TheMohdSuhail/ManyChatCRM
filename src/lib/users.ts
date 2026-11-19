import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const ROLES = ["ADMIN", "MEMBER"] as const;
export type Role = (typeof ROLES)[number];
export const MIN_PASSWORD = 8;

/** "scrypt$<salt hex>$<hash hex>" */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export type CurrentUser = { id: string; email: string; name: string; role: Role };

/** Cookie verify + DB check (user delete hua / password badla to session khatam). Ek request me ek hi baar chalta hai. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.u },
    select: { id: true, email: true, name: true, role: true, sessionVersion: true },
  });
  if (!user || user.sessionVersion !== session.v) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role as Role };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
