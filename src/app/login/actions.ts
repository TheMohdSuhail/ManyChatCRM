"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth";
import { normalizeEmail, verifyPassword } from "@/lib/users";

export type AuthState = { error?: string } | undefined;

// Brute-force se bachav (per server instance) — 15 min me 8 galat try ke baad ruk jao
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;
const fails = new Map<string, { n: number; first: number }>();

async function throttleKey(email: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  return `${ip}|${email}`;
}

function isLocked(key: string) {
  const f = fails.get(key);
  if (!f) return false;
  if (Date.now() - f.first > WINDOW_MS) {
    fails.delete(key);
    return false;
  }
  return f.n >= MAX_FAILS;
}

function recordFail(key: string) {
  const f = fails.get(key);
  if (!f || Date.now() - f.first > WINDOW_MS) fails.set(key, { n: 1, first: Date.now() });
  else f.n++;
}

function safeNext(next: FormDataEntryValue | null) {
  const n = String(next ?? "/");
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/login") ? n : "/";
}

async function startSession(userId: string, version: number) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(userId, version), sessionCookieOptions());
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  if (!process.env.AUTH_SECRET) return { error: ".env me AUTH_SECRET set karo, phir server restart karo." };
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Email aur password dono daalo." };

  const key = await throttleKey(email);
  if (isLocked(key)) return { error: "Bahut zyada galat try. 15 minute baad try karo." };

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    recordFail(key);
    await new Promise((r) => setTimeout(r, 400));
    return { error: "Email ya password galat hai." };
  }
  fails.delete(key);

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await startSession(user.id, user.sessionVersion);
  redirect(safeNext(form.get("next")));
}
