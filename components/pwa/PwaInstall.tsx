"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(event: BeforeInstallPromptEvent | null) => void>();

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function PwaRoot() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js?v=2");
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      deferredPrompt = event as BeforeInstallPromptEvent;
      promptListeners.forEach((listener) => listener(deferredPrompt));
    };

    const onInstalled = () => {
      deferredPrompt = null;
      promptListeners.forEach((listener) => listener(null));
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return null;
}

export function InstallAppButton({ variant = "dark" }: { variant?: "dark" | "light" | "nav" }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setPromptEvent(deferredPrompt);
    const listener = (event: BeforeInstallPromptEvent | null) => {
      setPromptEvent(event);
      if (!event && isStandalone()) setInstalled(true);
    };
    promptListeners.add(listener);
    return () => {
      promptListeners.delete(listener);
    };
  }, []);

  if (installed) return null;

  async function handleInstall() {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      return;
    }
    setHint(true);
  }

  const dark = variant === "dark";
  const nav = variant === "nav";

  return (
    <div className={dark ? "text-center" : ""}>
      <button
        type="button"
        onClick={() => void handleInstall()}
        className={
          nav
            ? "text-sm text-emerald-400 hover:text-emerald-300"
            : dark
              ? "mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:border-emerald-500"
              : "w-full rounded-xl px-3 py-3 text-left text-[15px] hover:bg-zinc-100"
        }
      >
        Instalar aplicativo
      </button>
      {hint && (
        <p className={`mt-2 text-xs leading-relaxed ${dark ? "text-zinc-400" : "text-zinc-500"}`}>
          No Chrome, toque no ícone de instalar na barra de endereço ou abra o menu ⋮ e escolha{" "}
          <strong>Instalar aplicativo</strong> / <strong>Instalar Meu Financeiro IA</strong>.
        </p>
      )}
    </div>
  );
}
