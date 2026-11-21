"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth";
import { MIN_PASSWORD, hashPassword, requireUser, verifyPassword } from "@/lib/users";

export type FormState = { error?: string; ok?: string } | undefined;

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Naam khali nahi ho sakta." };
  await prisma.user.update({ where: { id: me.id }, data: { name } });
  return { ok: "Profile save ho gaya." };
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (next.length < MIN_PASSWORD) return { error: `Naya password kam se kam ${MIN_PASSWORD} characters ka ho.` };
  if (next !== confirm) return { error: "Dono naye password match nahi kar rahe." };

  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(current, user.passwordHash))) return { error: "Current password galat hai." };

  // Baaki devices logout, ye device login rahe
  const updated = await prisma.user.update({
    where: { id: me.id },
    data: { passwordHash: await hashPassword(next), sessionVersion: { increment: 1 } },
  });
  (await cookies()).set(SESSION_COOKIE, await signSession(updated.id, updated.sessionVersion), sessionCookieOptions());
  return { ok: "Password badal gaya. Baaki sab devices se logout ho gaye." };
}

export async function logoutEverywhere() {
  const me = await requireUser();
  await prisma.user.update({ where: { id: me.id }, data: { sessionVersion: { increment: 1 } } });
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
