"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  RELOCK_AFTER_MS,
  disableLock,
  enableLock,
  lockSupported,
  readLockConfig,
  unlockedThisSession,
  verifyUser,
} from "@/lib/ui/app-lock";
import { logout } from "@/lib/ui/logout";

// Estado do bloqueio fora do React (lido com useSyncExternalStore): começa
// travado se o bloqueio estiver ligado e ainda não desbloqueou nesta sessão.
let locked: boolean | null = null;
let enabled: boolean | null = null;
const listeners = new Set<() => void>();

function readLocked() {
  if (locked === null) locked = Boolean(readLockConfig()) && !unlockedThisSession();
  return locked;
}
function readEnabled() {
  if (enabled === null) enabled = Boolean(readLockConfig());
  return enabled;
}
function emit() {
  listeners.forEach((listener) => listener());
}
function setLocked(value: boolean) {
  locked = value;
  emit();
}
function setEnabled(value: boolean) {
  enabled = value;
  emit();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const serverFalse = () => false;

/** Tela de bloqueio por cima do app (digital / Face ID / PIN do aparelho). */
export function AppLock() {
  const router = useRouter();
  const isLocked = useSyncExternalStore(subscribe, readLocked, serverFalse);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);

  // Saiu do app por mais de 2 min: trava de novo ao voltar.
  useEffect(() => {
    let hiddenAt = 0;
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (readEnabled() && hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) {
        setLocked(true);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  async function unlock() {
    setChecking(true);
    setFailed(false);
    const ok = await verifyUser();
    setChecking(false);
    if (ok) setLocked(false);
    else setFailed(true);
  }

  // Ao travar, já abre o pedido da digital (o botão fica para tentar de novo).
  useEffect(() => {
    if (!isLocked) return;
    let cancelled = false;
    void verifyUser().then((ok) => {
      if (cancelled) return;
      if (ok) setLocked(false);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isLocked]);

  async function signInWithPassword() {
    disableLock();
    setEnabled(false);
    try {
      await logout();
    } finally {
      setLocked(false);
      router.push("/login");
      router.refresh();
    }
  }

  if (!isLocked) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="App bloqueado"
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-6 bg-zinc-950 px-8 text-center"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- logo local pequeno */}
      <img src="/logo.png?v=2" alt="" width={72} height={72} className="h-18 w-18 rounded-3xl ring-1 ring-emerald-400/30" />
      <div>
        <p className="text-lg font-semibold text-white">Meu Financeiro bloqueado</p>
        <p className="mt-1 text-sm text-zinc-400">Use a digital, o rosto ou o PIN do celular para ver o seu dinheiro.</p>
      </div>
      <button
        type="button"
        onClick={() => void unlock()}
        disabled={checking}
        className="rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-zinc-950 disabled:opacity-60"
      >
        {checking ? "Conferindo…" : "🔓 Desbloquear"}
      </button>
      {failed && <p className="text-xs text-amber-300">Não deu certo. Toque em Desbloquear para tentar de novo.</p>}
      <button type="button" onClick={() => void signInWithPassword()} className="text-xs text-zinc-500 underline">
        Entrar com a senha da conta
      </button>
    </div>
  );
}

/** Item do menu: liga/desliga o bloqueio com digital neste aparelho. */
export function AppLockToggle() {
  const isEnabled = useSyncExternalStore(subscribe, readEnabled, serverFalse);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void lockSupported().then((value) => {
      if (!cancelled) setSupported(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!supported && !isEnabled) return null;

  async function toggle() {
    setBusy(true);
    setMessage("");
    try {
      if (isEnabled) {
        // Para desligar, confere que é o dono do celular.
        if (!(await verifyUser())) {
          setMessage("Não conferiu — o bloqueio continua ligado.");
          return;
        }
        disableLock();
        setEnabled(false);
      } else {
        await enableLock();
        setEnabled(true);
        setMessage("Pronto: o app vai pedir a digital ao abrir.");
      }
    } catch {
      setMessage("Não foi possível ativar agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={isEnabled}
      className="flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] hover:bg-zinc-900 disabled:opacity-60"
    >
      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-base">
        🔒
      </span>
      <span className="min-w-0 flex-1">
        <span className="block">Bloquear com digital</span>
        <span className="block text-xs text-zinc-500">{message || (isEnabled ? "Ligado neste celular" : "Desligado")}</span>
      </span>
      <span
        aria-hidden
        className={`relative h-6 w-10 shrink-0 rounded-full transition ${isEnabled ? "bg-emerald-500" : "bg-zinc-700"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${isEnabled ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
