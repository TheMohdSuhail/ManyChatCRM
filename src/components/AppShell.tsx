import { requireUser } from "@/lib/users";
import { MobileTabBar, MobileTopBar, Sidebar } from "@/components/Nav";

/** Har logged-in page isme wrap hota hai — yahin DB se user check hota hai (deleted user / purana session = login page) */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  return (
    <div className="min-h-screen">
      <Sidebar isAdmin={isAdmin} name={user.name} email={user.email} />
      <MobileTopBar name={user.name} />
      <div className="lg:pl-64">
        <main className="mx-auto max-w-7xl px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">{children}</main>
      </div>
      <MobileTabBar isAdmin={isAdmin} />
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
