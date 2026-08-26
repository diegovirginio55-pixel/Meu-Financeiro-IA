"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { InstallAppButton } from "@/components/pwa/PwaInstall";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { isActivePath, useOptimisticPath } from "@/lib/ui/use-optimistic-path";

const TABS = [
  { href: "/dashboard", label: "Início", icon: "🏠" },
  { href: "/mes", label: "Meu mês", icon: "📊" },
  { href: "/visao", label: "Dashboard", icon: "📈" },
  { href: "/detalhes", label: "Extrato", icon: "🧾" },
  { href: "/fluxo", label: "Fluxo", icon: "🔄" },
  { href: "/chat", label: "Chat IA", icon: "💬" },
  { href: "/ativos", label: "Investimentos", icon: "💹" },
  { href: "/bancos", label: "Bancos", icon: "🏦" },
] as const;

export default function TabNav() {
  const router = useRouter();
  const { path, onNavigate } = useOptimisticPath();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="relative sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
      <div className="flex w-full items-center justify-between gap-6 px-6 py-4 xl:px-10 2xl:px-14">
        <BrandLogo href="/dashboard" onClick={() => onNavigate("/dashboard")} />

        <nav className="flex min-w-0 flex-1 items-center justify-center">
          <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-zinc-800 bg-zinc-900/70 p-1">
            {TABS.map((tab) => {
              const active = isActivePath(path, tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  prefetch={tab.href !== "/visao" && tab.href !== "/ativos" && tab.href !== "/mes"}
                  onClick={() => onNavigate(tab.href)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                    active ? "bg-white font-medium text-zinc-950" : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  <span aria-hidden>{tab.icon}</span>
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-4">
          <ThemeToggle variant="nav" />
          <InstallAppButton variant="nav" />
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="text-sm text-zinc-500 hover:text-zinc-200"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
