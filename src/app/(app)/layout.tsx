import { AppShell } from "@/components/AppShell";

// Sidebar / tab bar yahan ek baar render hota hai. Page badalne par sirf andar ka content
// server se aata hai (nav dobara nahi banta) aur beech me loading.tsx turant dikhta hai.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
