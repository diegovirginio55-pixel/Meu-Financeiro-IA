"use client";

import { useEffect, useState } from "react";
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

function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    } catch {
      // silencioso — não é crítico
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial das notificações ao montar
    void load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const unread = notifications.filter((n) => !n.read_at).length;

  async function markRead(id?: string) {
    setNotifications((prev) =>
      prev.map((n) => (!id || n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)),
    );
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : {}),
      });
    } catch {
      // silencioso
    }
  }

  return { notifications, unread, loaded, markRead };
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
    <div className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
        <p className="text-sm font-semibold text-white">Notificações</p>
        <div className="flex items-center gap-3">
          {notifications.some((n) => !n.read_at) && (
            <button type="button" onClick={onMarkAllRead} className="text-xs text-emerald-400 hover:text-emerald-300">
              marcar todas como lidas
            </button>
          )}
          <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-200">
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
                {!n.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />}
                <span className="truncate text-sm font-medium text-zinc-100">{n.title}</span>
              </div>
              <p className="text-xs text-zinc-400">{n.body}</p>
              <p className="text-[11px] text-zinc-600">{timeAgo(n.sent_at)}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function NotificationBell({ variant = "nav" }: { variant?: "nav" | "menu" }) {
  const router = useRouter();
  const { notifications, unread, markRead } = useNotifications();
  const [open, setOpen] = useState(false);

  function handleItemClick(n: NotificationRow) {
    void markRead(n.id);
    setOpen(false);
    if (n.url) router.push(n.url);
  }

  if (variant === "menu") {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] hover:bg-zinc-900"
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
            <BellIcon className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
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
        aria-label="Notificações"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:text-white"
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
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
