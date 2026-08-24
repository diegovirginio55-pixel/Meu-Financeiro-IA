"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TABS = [
  { href: "/chat", label: "Conversa com IA", icon: "🤖" },
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/fluxo", label: "Fluxo", icon: "💸" },
  { href: "/detalhes", label: "Detalhes", icon: "📋" },
  { href: "/ativos", label: "Ativos", icon: "📈" },
  { href: "/bancos", label: "Bancos", icon: "🏦" },
];

export default function TabNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2 font-semibold text-zinc-50">
          <span>💰</span>
          <span className="hidden sm:inline">Meu Financeiro IA</span>
        </div>

        <nav className="flex max-w-[70%] items-center gap-1 overflow-x-auto rounded-full bg-zinc-900 p-1">
          {TABS.map((tab) => {
            const active = pathname?.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-emerald-600 text-white"
                    : "text-zinc-400 hover:text-zinc-100"
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="text-sm text-zinc-500 hover:text-zinc-200"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
