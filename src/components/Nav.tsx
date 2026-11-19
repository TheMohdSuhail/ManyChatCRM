"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Settings2, ShieldCheck, UserCircle2, LogOut } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", short: "Leads", icon: Users },
  { href: "/setup", label: "Setup", short: "Setup", icon: Settings2 },
  { href: "/users", label: "Team", short: "Team", icon: ShieldCheck, admin: true },
  { href: "/account", label: "My account", short: "Account", icon: UserCircle2 },
];

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
}

type Props = { isAdmin: boolean; name: string; email: string };

export function Sidebar({ isAdmin, name, email }: Props) {
  const isActive = useActive();
  const items = ITEMS.filter((i) => !i.admin || isAdmin);
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5">
        <Logo />
        <div>
          <div className="font-semibold leading-tight">Lead CRM</div>
          <div className="text-xs text-slate-500">ManyChat · Instagram</div>
        </div>
      </Link>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((i) => {
          const on = isActive(i.href);
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={on ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                on ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <i.icon className="h-[18px] w-[18px]" strokeWidth={on ? 2.25 : 1.75} />
              {i.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 rounded-xl p-2">
          <Initials name={name} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="truncate text-xs text-slate-500">{email}</div>
          </div>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}

export function MobileTopBar({ name }: { name: string }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <Logo small />
        Lead CRM
      </Link>
      <div className="flex items-center gap-1">
        <Link href="/account" aria-label="My account">
          <Initials name={name} small />
        </Link>
        <LogoutButton />
      </div>
    </header>
  );
}

export function MobileTabBar({ isAdmin }: { isAdmin: boolean }) {
  const isActive = useActive();
  const items = ITEMS.filter((i) => (!i.admin || isAdmin) && (isAdmin ? i.href !== "/account" : true));
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((i) => {
        const on = isActive(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={on ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${on ? "text-indigo-600" : "text-slate-500"}`}
          >
            <i.icon className="h-5 w-5" strokeWidth={on ? 2.25 : 1.75} />
            {i.short}
          </Link>
        );
      })}
    </nav>
  );
}

function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="post">
      <button className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="Logout" aria-label="Logout">
        <LogOut className="h-[18px] w-[18px]" />
      </button>
    </form>
  );
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <span
      className={`grid place-items-center rounded-xl bg-gradient-to-br from-pink-500 to-indigo-600 font-bold text-white shadow-sm ${
        small ? "h-8 w-8 text-sm" : "h-10 w-10"
      }`}
    >
      L
    </span>
  );
}

export function Initials({ name, small }: { name: string; small?: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-indigo-100 font-semibold text-indigo-700 ${small ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm"}`}>
      {initials || "?"}
    </span>
  );
}
