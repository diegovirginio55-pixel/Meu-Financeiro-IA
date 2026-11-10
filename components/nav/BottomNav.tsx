"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/lib/ui/logout";
import { InstallAppButton } from "@/components/pwa/PwaInstall";
import { AppLockToggle } from "@/components/pwa/AppLock";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { isActivePath, useOptimisticPath } from "@/lib/ui/use-optimistic-path";
import { NotificationBell, UnreadBadge, useNotifications } from "@/components/notifications/NotificationBell";

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

const MENU_ROUTES = ["/contas", "/retrospectiva", "/detalhes", "/bancos", "/fluxo", "/mes", "/metas"];

const MENU_ITEMS = [
  { href: "/contas", label: "Contas do mês", icon: "🗓️" },
  { href: "/retrospectiva", label: "Retrospectiva", icon: "✨" },
  { href: "/detalhes", label: "Extrato", icon: "🧾" },
  { href: "/mes", label: "Meu mês", icon: "📊" },
  { href: "/metas", label: "Metas", icon: "🎯" },
  { href: "/bancos", label: "Bancos conectados", icon: "🏦" },
  { href: "/fluxo", label: "Fluxo de caixa", icon: "🔄" },
];

export default function BottomNav() {
  const router = useRouter();
  const { path, onNavigate } = useOptimisticPath();
  const { unread } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuActive = MENU_ROUTES.some((route) => isActivePath(path, route));
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  function closeMenu({ restoreFocus = false }: { restoreFocus?: boolean } = {}) {
    setMenuOpen(false);
    if (restoreFocus) menuButtonRef.current?.focus();
  }

  // Menu aberto: foco inicial no primeiro item e Esc fecha (devolvendo o foco ao botão Menu).
  useEffect(() => {
    if (!menuOpen) return;
    firstItemRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  const menuLabel = unread > 0 ? `Menu (${unread} notificações não lidas)` : "Menu";

  return (
    <>
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => closeMenu({ restoreFocus: true })}>
          <div
            id="mf-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-x-0 bottom-16 w-full rounded-t-3xl border-t border-zinc-800 bg-zinc-950 p-5 text-zinc-100 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <BrandLogo size="menu" />
            <p className="mt-4 text-sm font-semibold text-zinc-400">Menu</p>
            <div className="mt-3 flex flex-col gap-1">
              {MENU_ITEMS.map((item, index) => (
                <Link
                  key={item.href}
                  ref={index === 0 ? firstItemRef : undefined}
                  href={item.href}
                  prefetch
                  onClick={() => {
                    onNavigate(item.href);
                    closeMenu();
                  }}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] hover:bg-zinc-900"
                >
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-base"
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              ))}
              <NotificationBell variant="menu" onNavigate={() => closeMenu()} />
              <ThemeToggle variant="menu" />
              <AppLockToggle />
              <InstallAppButton variant="menu" />
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] text-red-400 hover:bg-red-950/40 disabled:opacity-60"
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-base"
                >
                  🚪
                </span>
                {loggingOut ? "Saindo…" : "Sair"}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-50 w-full border-t border-zinc-800 bg-zinc-950/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur"
      >
        <div className="grid grid-cols-5 px-1 py-1.5">
          {TABS.map((tab) => {
            const active = isActivePath(path, tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                prefetch
                onClick={() => {
                  onNavigate(tab.href);
                  closeMenu();
                }}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center gap-0.5 text-[11px]"
              >
                <span className="flex h-9 w-9 items-center justify-center">
                  <Icon active={active} />
                </span>
                <span className={active ? "font-semibold text-emerald-400" : "text-zinc-400"}>{tab.label}</span>
              </Link>
            );
          })}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuLabel}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? "mf-mobile-menu" : undefined}
            className="flex flex-col items-center gap-0.5 text-[11px] text-zinc-400"
          >
            <span className="relative flex h-9 w-9 items-center justify-center">
              <MenuIcon active={menuActive || menuOpen} />
              <UnreadBadge className="absolute right-0 top-0.5" />
            </span>
            <span className={menuActive || menuOpen ? "font-semibold text-emerald-400" : "text-zinc-400"}>
              Menu
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
