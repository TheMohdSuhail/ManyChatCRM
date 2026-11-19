import { redirect } from "next/navigation";
import { BarChart3, MessageCircle, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/users";
import { Logo } from "@/components/Nav";
import { LoginForm } from "./AuthForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect("/");
  const missingSecret = !process.env.AUTH_SECRET;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-pink-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-pink-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3 text-lg font-semibold">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 font-bold backdrop-blur">L</span>
          Lead CRM
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">Instagram ki har lead, ek jagah.</h2>
          <p className="mt-4 text-indigo-100">ManyChat automations aur Instagram DMs se aayi leads ko track karo, follow-up karo aur convert karo.</p>
          <ul className="mt-8 space-y-3 text-sm text-indigo-50">
            <li className="flex items-center gap-3"><MessageCircle className="h-5 w-5 text-pink-200" /> ManyChat + Instagram DM auto capture</li>
            <li className="flex items-center gap-3"><Users className="h-5 w-5 text-pink-200" /> Pipeline, notes aur follow-ups</li>
            <li className="flex items-center gap-3"><BarChart3 className="h-5 w-5 text-pink-200" /> Daily stats aur Excel export</li>
          </ul>
        </div>
        <div className="relative text-xs text-indigo-200">Secure login · Team accounts</div>
      </div>

      <div className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo />
            <div>
              <div className="font-semibold">Lead CRM</div>
              <div className="text-xs text-slate-500">ManyChat · Instagram</div>
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 mb-6 text-sm text-slate-500">
            Apne email aur password se login karo.
          </p>
          {missingSecret && (
            <p className="alert-warn mb-4">
              .env me <code className="font-semibold">AUTH_SECRET</code> set karo, phir server restart karo.
            </p>
          )}
          <LoginForm next={next ?? "/"} />
          <p className="mt-6 text-center text-xs text-slate-400">Password bhool gaye? Admin se reset karwao.</p>
        </div>
      </div>
    </div>
  );
}
