"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { InstallAppButton } from "@/components/pwa/PwaInstall";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { isActivePath, useOptimisticPath } from "@/lib/ui/use-optimistic-path";

const TABS = [
  { href: "/dashboard", label: "Início", icon: HomeIcon },
  { href: "/ativos", label: "Ativos", icon: AtivosIcon },
  { href: "/visao", label: "Dashboard", icon: DashboardIcon },
  { href: "/chat", label: "Chat IA", icon: ChatIcon },
] as const;

function HomeIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        fill={active ? "#10B981" : "none"}
        stroke={active ? "#10B981" : "#71717A"}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AtivosIcon({ active }: { active?: boolean }) {
  const color = active ? "#10B981" : "#71717A";
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <path
        d="M4 16.5 9.2 11l3.4 3.3L20 7"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15.5 7H20v4.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DashboardIcon({ active }: { active?: boolean }) {
  const color = active ? "#10B981" : "#71717A";
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6" stroke={color} strokeWidth="1.6" />
      <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.6" stroke={color} strokeWidth="1.6" />
      <rect x="13" y="10.5" width="7.5" height="10" rx="1.6" stroke={color} strokeWidth="1.6" />
      <rect x="3.5" y="13.5" width="7.5" height="7" rx="1.6" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

function ChatIcon({ active }: { active?: boolean }) {
  const color = active ? "#10B981" : "#71717A";
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <path
        d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 16.5H11l-4 3v-3H5A1.5 1.5 0 0 1 3.5 15V8A1.5 1.5 0 0 1 5 6.5Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <path
        d="M5 7h14M5 12h14M5 17h14"
        stroke={active ? "#10B981" : "#71717A"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

const MENU_ROUTES = ["/detalhes", "/bancos", "/fluxo"];

export default function BottomNav() {
  const router = useRouter();
  const { path, onNavigate } = useOptimisticPath();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuActive = MENU_ROUTES.some((route) => isActivePath(path, route));

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-16 w-full rounded-t-3xl border-t border-zinc-800 bg-zinc-950 p-5 text-zinc-100 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <BrandLogo size="menu" />
            <p className="mt-4 text-sm font-semibold text-zinc-400">Menu</p>
            <div className="mt-3 flex flex-col gap-1">
              {[
                { href: "/detalhes", label: "Extrato" },
                { href: "/bancos", label: "Bancos conectados" },
                { href: "/fluxo", label: "Fluxo de caixa" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    onNavigate(item.href);
                    setMenuOpen(false);
                  }}
                  className="rounded-xl px-3 py-3 text-left text-[15px] hover:bg-zinc-900"
                >
                  {item.label}
                </Link>
              ))}
              <ThemeToggle variant="menu" />
              <InstallAppButton variant="menu" />
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-xl px-3 py-3 text-left text-[15px] text-red-400 hover:bg-red-950/40"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50 w-full border-t border-zinc-800 bg-zinc-950/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="grid grid-cols-5 px-1 py-1.5">
          {TABS.map((tab) => {
            const active = isActivePath(path, tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch={tab.href !== "/visao" && tab.href !== "/ativos"}
                onClick={() => onNavigate(tab.href)}
                className="flex flex-col items-center gap-0.5 text-[11px]"
              >
                <span className="flex h-9 w-9 items-center justify-center">
                  <Icon active={active} />
                </span>
                <span className={active ? "font-semibold text-emerald-400" : "text-zinc-500"}>{tab.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex flex-col items-center gap-0.5 text-[11px] text-zinc-500"
          >
            <span className="flex h-9 w-9 items-center justify-center">
              <MenuIcon active={menuActive || menuOpen} />
            </span>
            <span className={menuActive || menuOpen ? "font-semibold text-emerald-400" : "text-zinc-500"}>
              Menu
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
