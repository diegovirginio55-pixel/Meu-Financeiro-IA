"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { InstallAppButton } from "@/components/pwa/PwaInstall";

const TABS = [
  { href: "/dashboard", label: "Início", icon: HomeIcon },
  { href: "/detalhes", label: "Extrato", icon: ExtratoIcon },
  { href: "/fluxo", label: "Pix", icon: PixIcon },
  { href: "/chat", label: "Chat", icon: ChatIcon },
] as const;

function HomeIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        fill={active ? "#FFFFFF" : "none"}
        stroke={active ? "#FFFFFF" : "#6B7C86"}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExtratoIcon({ active }: { active?: boolean }) {
  const color = active ? "#005CA9" : "#6B7C86";
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <rect x="5" y="3.5" width="14" height="17" rx="2" stroke={color} strokeWidth="1.6" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PixIcon({ active }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path
        fill={active ? "#005CA9" : "#6B7C86"}
        d="M12.8 4.3 19.7 11.2a1.1 1.1 0 0 1 0 1.6l-6.9 6.9a1.1 1.1 0 0 1-1.6 0L4.3 12.8a1.1 1.1 0 0 1 0-1.6l6.9-6.9a1.1 1.1 0 0 1 1.6 0Z"
      />
    </svg>
  );
}

function ChatIcon({ active }: { active?: boolean }) {
  const color = active ? "#005CA9" : "#6B7C86";
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

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
      <path d="M5 7h14M5 12h14M5 17h14" stroke="#6B7C86" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

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
            className="absolute inset-x-0 bottom-16 mx-auto w-full max-w-[430px] rounded-t-3xl bg-white p-5 text-zinc-800 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-semibold text-zinc-500">Menu</p>
            <div className="mt-3 flex flex-col gap-1">
              {[
                { href: "/visao", label: "Visão geral e gráficos" },
                { href: "/ativos", label: "Investimentos" },
                { href: "/bancos", label: "Bancos conectados" },
                { href: "/fluxo", label: "Fluxo de caixa" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-3 py-3 text-left text-[15px] hover:bg-zinc-100"
                >
                  {item.label}
                </Link>
              ))}
              <InstallAppButton variant="light" />
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-xl px-3 py-3 text-left text-[15px] text-red-600 hover:bg-red-50"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 border-t border-zinc-200 bg-[#EEF1F3] pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 px-1 py-1.5">
          {TABS.map((tab) => {
            const active = pathname === tab.href || (tab.href !== "/dashboard" && pathname.startsWith(tab.href));
            const Icon = tab.icon;
            const homeActive = tab.href === "/dashboard" && active;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex flex-col items-center gap-0.5 text-[11px]"
              >
                <span
                  className={
                    homeActive
                      ? "flex h-9 w-9 items-center justify-center rounded-full bg-[#005CA9]"
                      : "flex h-9 w-9 items-center justify-center"
                  }
                >
                  <Icon active={active} />
                </span>
                <span className={active ? "font-semibold text-[#005CA9]" : "text-[#6B7C86]"}>{tab.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex flex-col items-center gap-0.5 text-[11px] text-[#6B7C86]"
          >
            <span className="flex h-9 w-9 items-center justify-center">
              <MenuIcon />
            </span>
            Menu
          </button>
        </div>
      </nav>
    </>
  );
}
