// Admin account banao ya uska password reset karo (login page par setup form nahi hai).
//
//   ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="..." npm run admin:set
//   (optional ADMIN_NAME="Your Name")
//
// CRM me sirf ek admin rehta hai: agar koi aur admin hai to wo Member ban jayega.
// Password badalne par us admin ke saare purane logins band ho jaate hain.
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";
const name = (process.env.ADMIN_NAME ?? "").trim() || "Admin";

if (!/^\S+@\S+\.\S+$/.test(email)) {
  console.error("ADMIN_EMAIL sahi email do");
  process.exit(1);
}
if (password.length < 8) {
  console.error("ADMIN_PASSWORD kam se kam 8 characters ka ho");
  process.exit(1);
}

// src/lib/users.ts hashPassword jaisa hi format: scrypt$<salt>$<hash>
const salt = randomBytes(16);
const passwordHash = `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 64).toString("hex")}`;

const prisma = new PrismaClient();
try {
  const admin = await prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash, role: "ADMIN" },
    update: { passwordHash, role: "ADMIN", sessionVersion: { increment: 1 }, ...(process.env.ADMIN_NAME ? { name } : {}) },
  });
  const demoted = await prisma.user.updateMany({
    where: { role: "ADMIN", id: { not: admin.id } },
    data: { role: "MEMBER", sessionVersion: { increment: 1 } },
  });
  console.log(`✓ Admin ready: ${admin.email}${demoted.count ? ` (${demoted.count} purane admin ab Member)` : ""}`);
} finally {
  await prisma.$disconnect();
}
