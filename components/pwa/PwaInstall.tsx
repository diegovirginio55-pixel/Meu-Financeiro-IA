"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaStore = {
  prompt: BeforeInstallPromptEvent | null;
  listeners: Set<(event: BeforeInstallPromptEvent | null) => void>;
  started: boolean;
};

const store: PwaStore =
  (globalThis as typeof globalThis & { __pwaInstall?: PwaStore }).__pwaInstall ??
  ((globalThis as typeof globalThis & { __pwaInstall?: PwaStore }).__pwaInstall = {
    prompt: null,
    listeners: new Set(),
    started: false,
  });

function startPwaCapture() {
  if (store.started || typeof window === "undefined") return;
  store.started = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    store.prompt = event as BeforeInstallPromptEvent;
    store.listeners.forEach((listener) => listener(store.prompt));
  });

  window.addEventListener("appinstalled", () => {
    store.prompt = null;
    store.listeners.forEach((listener) => listener(null));
  });
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    ("standalone" in window.navigator &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function installGuide() {
  const ua = navigator.userAgent;
  const ios =
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const iosChrome = ios && /CriOS|FxiOS|EdgiOS/i.test(ua);
  const android = /Android/i.test(ua);

  if (iosChrome) {
    return [
      "No iPhone o app não instala pelo Chrome.",
      "Abra este mesmo site no Safari.",
      "Toque em Compartilhar e depois em Adicionar à Tela de Início.",
    ];
  }
  if (ios) {
    return [
      "Toque no botão Compartilhar (quadrado com seta para cima).",
      "Role a lista e toque em Adicionar à Tela de Início.",
      "Toque em Adicionar no canto superior direito.",
    ];
  }
  if (android) {
    return [
      "Toque no menu ⋮ no canto do Chrome.",
      "Toque em Instalar aplicativo ou Adicionar à tela inicial.",
      "Confirme em Instalar.",
    ];
  }
  return [
    "No Chrome ou Edge, clique no ícone de instalar na barra de endereço.",
    "Ou abra o menu ⋮ e escolha Instalar Meu Financeiro IA.",
  ];
}

export function PwaRoot() {
  useEffect(() => {
    startPwaCapture();
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js?v=3", { scope: "/" });
    }
  }, []);

  return null;
}

export function InstallAppButton({
  variant = "dark",
}: {
  variant?: "dark" | "light" | "nav" | "menu";
}) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    startPwaCapture();
    setInstalled(isStandalone());
    setPromptEvent(store.prompt);
    const listener = (event: BeforeInstallPromptEvent | null) => {
      setPromptEvent(event);
      if (!event && isStandalone()) setInstalled(true);
    };
    store.listeners.add(listener);
    return () => {
      store.listeners.delete(listener);
    };
  }, []);

  if (installed) return null;

  async function handleInstall() {
    if (promptEvent) {
      setBusy(true);
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        store.prompt = null;
        setPromptEvent(null);
        if (choice.outcome === "accepted") setInstalled(true);
      } finally {
        setBusy(false);
      }
      return;
    }
    setOpen(true);
  }

  const className =
    variant === "nav"
      ? "text-sm text-emerald-400 hover:text-emerald-300"
      : variant === "menu"
        ? "w-full rounded-xl px-3 py-3 text-left text-[15px] hover:bg-zinc-900"
        : variant === "dark"
          ? "mt-6 w-full rounded-full bg-white px-4 py-2.5 text-sm font-medium text-zinc-950"
          : "w-full rounded-xl px-3 py-3 text-left text-[15px] hover:bg-zinc-100";

  return (
    <div className={variant === "dark" ? "text-center" : ""}>
      <button type="button" onClick={() => void handleInstall()} className={className} disabled={busy}>
        {busy ? "Abrindo instalação…" : "Instalar aplicativo"}
      </button>
      {open && (
        <div className={variant === "nav" ? "absolute right-6 top-16 z-50 w-80" : "mt-3"}>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-left shadow-xl">
            <p className="text-sm font-medium text-white">Como instalar</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm leading-relaxed text-zinc-400">
              {installGuide().map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 text-xs text-emerald-400"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
