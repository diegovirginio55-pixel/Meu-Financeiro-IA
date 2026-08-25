"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { InstallAppButton } from "@/components/pwa/PwaInstall";
import { isActivePath, useOptimisticPath } from "@/lib/ui/use-optimistic-path";

const TABS = [
  { href: "/dashboard", label: "Início" },
  { href: "/visao", label: "Dashboard" },
  { href: "/detalhes", label: "Extrato" },
  { href: "/fluxo", label: "Fluxo" },
  { href: "/chat", label: "Chat" },
  { href: "/ativos", label: "Investimentos" },
  { href: "/bancos", label: "Bancos" },
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
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 lg:px-8">
        <Link href="/dashboard" prefetch onClick={() => onNavigate("/dashboard")} className="shrink-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-emerald-400/90">Meu Financeiro</p>
          <p className="text-sm font-semibold tracking-tight text-white">IA</p>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center justify-center">
          <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-zinc-800 bg-zinc-900/70 p-1">
            {TABS.map((tab) => {
              const active = isActivePath(path, tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  prefetch
                  onClick={() => onNavigate(tab.href)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                    active ? "bg-white font-medium text-zinc-950" : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-4">
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
