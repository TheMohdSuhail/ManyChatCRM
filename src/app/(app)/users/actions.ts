"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { MIN_PASSWORD, hashPassword, normalizeEmail, requireAdmin } from "@/lib/users";

export type FormState = { error?: string; ok?: string } | undefined;

export async function createUser(_: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Sahi naam aur email daalo." };
  if (password.length < MIN_PASSWORD) return { error: `Password kam se kam ${MIN_PASSWORD} characters ka ho.` };
  if (await prisma.user.findUnique({ where: { email } })) return { error: "Is email se user pehle se hai." };

  // Sirf ek admin rehta hai — Team page se sirf Members bante hain
  await prisma.user.create({ data: { name, email, role: "MEMBER", passwordHash: await hashPassword(password) } });
  revalidatePath("/users");
  return { ok: `${name} add ho gaya. Unhe email + password de do.` };
}

export async function resetUserPassword(id: string, password: string): Promise<FormState> {
  await requireAdmin();
  if (password.length < MIN_PASSWORD) return { error: `Kam se kam ${MIN_PASSWORD} characters.` };
  // sessionVersion badhao -> us user ke saare purane logins band
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(password), sessionVersion: { increment: 1 } },
  });
  revalidatePath("/users");
  return { ok: "Password badal gaya, purane logins band." };
}

export async function deleteUser(id: string) {
  const me = await requireAdmin();
  if (id === me.id) throw new Error("Khud ko delete nahi kar sakte");
  const target = await prisma.user.findUnique({ where: { id } });
  if (target?.role === "ADMIN") throw new Error("Admin ko delete nahi kar sakte");
  await prisma.user.delete({ where: { id } });
  revalidatePath("/users");
}
