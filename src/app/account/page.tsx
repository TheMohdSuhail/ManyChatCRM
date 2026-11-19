import { requireUser } from "@/lib/users";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Initials } from "@/components/Nav";
import { ChangePasswordForm, LogoutEverywhereButton, ProfileForm } from "./AccountForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "My account" };

export default async function AccountPage() {
  const me = await requireUser();
  return (
    <AppShell>
      <PageHeader title="My account" />
      <div className="grid max-w-4xl gap-6 md:grid-cols-2">
        <div className="card p-5">
          <div className="mb-5 flex items-center gap-3">
            <Initials name={me.name} />
            <div className="min-w-0">
              <div className="truncate font-medium">{me.email}</div>
              <div className="text-xs text-slate-500">{me.role === "ADMIN" ? "Admin" : "Member"}</div>
            </div>
          </div>
          <ProfileForm name={me.name} />
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-medium">Password badlo</h2>
          <ChangePasswordForm />
        </div>

        <div className="card p-5 md:col-span-2">
          <h2 className="font-medium">Sab devices se logout</h2>
          <p className="mt-1 mb-4 text-sm text-slate-500">Phone kho gaya ya kisi aur ke computer pe login reh gaya? Ye sab jagah se logout kar dega (is device se bhi).</p>
          <LogoutEverywhereButton />
        </div>
      </div>
    </AppShell>
  );
}
