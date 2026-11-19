import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/users";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Initials } from "@/components/Nav";
import { fmtIST } from "@/lib/time";
import { AddUserForm, UserRowActions } from "./UserControls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team" };

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, email: true, role: true, lastLoginAt: true, createdAt: true },
  });

  return (
    <AppShell>
      <PageHeader title="Team" sub="Kaun CRM me login kar sakta hai. Admin sirf ek hai (aap); yahan se team Members add karo jo leads par kaam karein." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-medium">
              Users <span className="text-sm font-normal text-slate-400">({users.length})</span>
            </h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Initials name={u.name} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">{u.name}</span>
                      {u.id === me.id && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">You</span>}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          u.role === "ADMIN" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {u.role === "ADMIN" ? "Admin" : "Member"}
                      </span>
                    </div>
                    <div className="truncate text-sm text-slate-500">{u.email}</div>
                    <div className="text-xs text-slate-400">Last login: {u.lastLoginAt ? fmtIST(u.lastLoginAt) : "kabhi nahi"}</div>
                  </div>
                </div>
                <UserRowActions id={u.id} role={u.role} isMe={u.id === me.id} name={u.name} />
              </li>
            ))}
          </ul>
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-1 font-medium">Naya member add karo</h2>
          <p className="mb-4 text-sm text-slate-500">Email + password bana ke unhe bhej do. Wo login ke baad apna password badal sakte hain.</p>
          <AddUserForm />
        </div>
      </div>
    </AppShell>
  );
}
