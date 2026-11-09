"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const DISMISS_KEY = "mf-push-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const ios = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || ios;
}

function isIos() {
  const ua = navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

async function subscribePush() {
  const keyRes = await fetch("/api/push/public-key");
  const keyBody = (await keyRes.json()) as { publicKey?: string };
  if (!keyRes.ok || !keyBody.publicKey) throw new Error("no-key");

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(keyBody.publicKey),
  });
  const json = subscription.toJSON();
  const save = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  });
  if (!save.ok) throw new Error("save");
}

function pushSupported() {
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

/** O convite aparece só se o navegador suporta, ainda não decidiu a permissão e não foi dispensado nesta sessão. */
function shouldOfferPush() {
  if (!pushSupported()) return false;
  if (isIos() && !isStandalone()) return false;
  if (Notification.permission !== "default") return false;
  try {
    return sessionStorage.getItem(DISMISS_KEY) !== "1";
  } catch {
    return false;
  }
}

const noopSubscribe = () => () => undefined;
const serverFalse = () => false;

export function PushEnable() {
  // Lido do navegador sem setState em efeito; no servidor/hidratação vale false (nada renderizado).
  const offer = useSyncExternalStore(noopSubscribe, shouldOfferPush, serverFalse);
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const visible = offer && !closed;

  useEffect(() => {
    // Permissão já concedida: garante que a inscrição deste aparelho está salva no servidor.
    if (!pushSupported()) return;
    if (isIos() && !isStandalone()) return;
    if (Notification.permission === "granted") void subscribePush().catch(() => undefined);
  }, []);

  async function enable() {
    setBusy(true);
    setHint("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setHint("Permissão negada. Você pode ativar depois nas configurações do navegador.");
        setBusy(false);
        return;
      }
      await subscribePush();
      setClosed(true);
    } catch {
      setHint("Não deu para ativar agora. Instale o app e tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Ativar notificações"
      className="fixed inset-x-3 top-3 z-[9998] flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 p-3 shadow-2xl lg:left-auto lg:right-5 lg:top-20 lg:w-[min(28rem,calc(100vw-2.5rem))]"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">Avisos de movimentação</p>
        <p className="text-[11px] leading-snug text-zinc-400">
          Receba uma notificação quando entrar ou sair dinheiro em qualquer banco conectado.
        </p>
        {hint && <p className="mt-1 text-[11px] text-amber-300">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => void enable()}
          disabled={busy}
          className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-zinc-950 disabled:opacity-60"
        >
          {busy ? "Ativando…" : "Ativar"}
        </button>
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* ignore */
            }
            setClosed(true);
          }}
          aria-label="Dispensar"
          className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
