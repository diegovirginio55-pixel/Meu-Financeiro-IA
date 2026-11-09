"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  sent_at: string;
  read_at: string | null;
}

const POLL_MS = 60_000;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

function BellIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M6 10a6 6 0 1 1 12 0c0 3.2 1 4.6 1.6 5.4a1 1 0 0 1-.8 1.6H5.2a1 1 0 0 1-.8-1.6C5 14.6 6 13.2 6 10Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9.5 19.5a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

interface NotificationsState {
  notifications: NotificationRow[];
  unread: number;
  loaded: boolean;
  markRead: (id?: string) => Promise<void>;
  reload: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsState | null>(null);

function useNotificationsSource(): NotificationsState {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(
    (): Promise<void> =>
      fetch("/api/notifications", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { notifications?: NotificationRow[] } | null) => {
          if (data) setNotifications(data.notifications ?? []);
        })
        .catch(() => undefined) // silencioso — não é crítico
        .finally(() => setLoaded(true)),
    [],
  );

  useEffect(() => {
    let intervalId: number | null = null;

    function startPolling() {
      if (intervalId == null) intervalId = window.setInterval(() => void reload(), POLL_MS);
    }
    function stopPolling() {
      if (intervalId != null) window.clearInterval(intervalId);
      intervalId = null;
    }

    // Com o app em segundo plano não faz polling; ao voltar, atualiza na hora e retoma.
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        stopPolling();
      } else {
        void reload();
        startPolling();
      }
    }

    // Push recebido com o app aberto: o service worker avisa e a lista é recarregada na hora.
    function handleSwMessage(event: MessageEvent) {
      const type = (event.data as { type?: string } | null)?.type;
      if (type === "mf:push-received") void reload();
    }

    void reload();
    if (document.visibilityState !== "hidden") startPolling();
    document.addEventListener("visibilitychange", handleVisibility);
    const sw = "serviceWorker" in navigator ? navigator.serviceWorker : null;
    sw?.addEventListener("message", handleSwMessage);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
      sw?.removeEventListener("message", handleSwMessage);
    };
  }, [reload]);

  const unread = notifications.filter((n) => !n.read_at).length;

  const markRead = useCallback(
    async (id?: string) => {
      const affected = new Set(notifications.filter((n) => !n.read_at && (!id || n.id === id)).map((n) => n.id));
      if (affected.size === 0) return;
      const readAt = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => (affected.has(n.id) ? { ...n, read_at: n.read_at ?? readAt } : n)));
      let ok = false;
      try {
        const res = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(id ? { id } : {}),
        });
        ok = res.ok;
      } catch {
        ok = false;
      }
      // Falhou: desfaz a marcação otimista para não esconder notificações não lidas.
      if (!ok) {
        setNotifications((prev) =>
          prev.map((n) => (affected.has(n.id) && n.read_at === readAt ? { ...n, read_at: null } : n)),
        );
      }
    },
    [notifications],
  );

  return useMemo(
    () => ({ notifications, unread, loaded, markRead, reload }),
    [notifications, unread, loaded, markRead, reload],
  );
}

/** Uma única fonte de notificações para o app (sino do topo, menu e badge do celular). */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const value = useNotificationsSource();
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

const EMPTY_STATE: NotificationsState = {
  notifications: [],
  unread: 0,
  loaded: false,
  markRead: async () => undefined,
  reload: async () => undefined,
};

export function useNotifications(): NotificationsState {
  return useContext(NotificationsContext) ?? EMPTY_STATE;
}

/** Badge de não lidas (ex.: botão Menu do celular). */
export function UnreadBadge({ className = "" }: { className?: string }) {
  const { unread } = useNotifications();
  if (unread <= 0) return null;
  return (
    <span
      className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white ${className}`}
    >
      {unread > 9 ? "9+" : unread}
      <span className="sr-only"> notificações não lidas</span>
    </span>
  );
}

function Panel({
  notifications,
  onItemClick,
  onMarkAllRead,
  onClose,
}: {
  notifications: NotificationRow[];
  onItemClick: (n: NotificationRow) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mf-notifications-title"
      className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
        <p id="mf-notifications-title" className="text-sm font-semibold text-white">
          Notificações
        </p>
        <div className="flex items-center gap-3">
          {notifications.some((n) => !n.read_at) && (
            <button type="button" onClick={onMarkAllRead} className="text-xs text-emerald-400 hover:text-emerald-300">
              marcar todas como lidas
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            Fechar
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">Nenhuma notificação por aqui ainda.</p>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onItemClick(n)}
              className={`flex w-full flex-col gap-0.5 border-b border-zinc-900 px-4 py-3 text-left last:border-0 hover:bg-zinc-900 ${
                n.read_at ? "" : "bg-emerald-500/[0.04]"
              }`}
            >
              <div className="flex items-center gap-2">
                {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden />}
                {!n.read_at && <span className="sr-only">Não lida:</span>}
                <span className="truncate text-sm font-medium text-zinc-100">{n.title}</span>
              </div>
              <p className="text-xs text-zinc-400">{n.body}</p>
              <p className="text-[11px] text-zinc-500">{timeAgo(n.sent_at)}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function NotificationBell({
  variant = "nav",
  onNavigate,
}: {
  variant?: "nav" | "menu";
  /** Chamado ao abrir o link de uma notificação (ex.: fechar o menu do celular). */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { notifications, unread, markRead } = useNotifications();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open]);

  function handleItemClick(n: NotificationRow) {
    void markRead(n.id);
    setOpen(false);
    if (n.url) {
      onNavigate?.();
      router.push(n.url);
    }
  }

  const badge =
    unread > 0 ? (
      <span className="absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
        {unread > 9 ? "9+" : unread}
      </span>
    ) : null;
  const label = unread > 0 ? `Notificações (${unread} não lidas)` : "Notificações";

  if (variant === "menu") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          aria-haspopup="dialog"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] hover:bg-zinc-900"
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 [&>span]:-right-0.5 [&>span]:-top-0.5">
            <BellIcon className="h-5 w-5" />
            {badge}
          </span>
          <span>Notificações</span>
        </button>
        {open && (
          <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] sm:items-center sm:pb-4"
            onClick={() => setOpen(false)}
          >
            <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <Panel
                notifications={notifications}
                onItemClick={handleItemClick}
                onMarkAllRead={() => void markRead()}
                onClose={() => setOpen(false)}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:text-white [&>span]:right-0.5 [&>span]:top-0.5"
      >
        <BellIcon className="h-5 w-5" />
        {badge}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50">
            <Panel
              notifications={notifications}
              onItemClick={handleItemClick}
              onMarkAllRead={() => void markRead()}
              onClose={() => setOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}
