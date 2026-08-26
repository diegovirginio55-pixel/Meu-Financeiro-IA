"use client";

import { useEffect, useState } from "react";
import { usePwaInstall } from "./usePwaInstall";

export function PwaRoot() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => void registration.update())
      .catch(() => undefined);

    if (navigator.serviceWorker.controller) return;

    const onControllerChange = () => {
      try {
        if (sessionStorage.getItem("mf-sw-reload") === "1") return;
        sessionStorage.setItem("mf-sw-reload", "1");
      } catch {
        return;
      }
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  return <PwaInstallBanner />;
}

export function PwaInstallBanner() {
  const { canInstall, isIos, isIosSafari, isAndroidChrome, isDesktopChrome, installed, dismissed, promptInstall, dismiss } =
    usePwaInstall();
  const [showHelp, setShowHelp] = useState(false);

  if (installed || dismissed) return null;
  if (!canInstall && !isIos && !isAndroidChrome && !isDesktopChrome) return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar aplicativo"
      className="fixed inset-x-3 z-[9999] flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 p-3 shadow-2xl max-lg:bottom-[calc(5.75rem+env(safe-area-inset-bottom))] lg:bottom-5 lg:left-auto lg:right-5 lg:w-[min(28rem,calc(100vw-2.5rem))]"
    >
      <img src="/icon-192.png?v=2" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">Instalar o Meu Financeiro</p>
        <p className="text-[11px] leading-snug text-zinc-400">
          Adicione o app à tela inicial para abrir mais rápido e em tela cheia.
        </p>
        {showHelp && isIos && (
          <p className="mt-1 text-[11px] leading-snug text-zinc-300">
            {isIosSafari
              ? "Toque em Compartilhar e depois em “Adicionar à Tela de Início”."
              : "No iPhone o app instala pelo Safari. Abra este site no Safari, toque em Compartilhar e em Adicionar à Tela de Início."}
          </p>
        )}
        {showHelp && isAndroidChrome && !canInstall && (
          <p className="mt-1 text-[11px] leading-snug text-zinc-300">
            Toque nos 3 pontos e escolha “Instalar app” ou “Adicionar à tela inicial”.
          </p>
        )}
        {showHelp && isDesktopChrome && !canInstall && (
          <p className="mt-1 text-[11px] leading-snug text-zinc-300">
            Clique no ícone de instalação na barra de endereço (monitor com seta) ou em ⋮ → Instalar página como app.
            O Chrome usa esse nome; o app deve abrir em janela própria, sem barra de endereço.
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {canInstall ? (
          <button
            type="button"
            onClick={() => void promptInstall()}
            className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-zinc-950"
          >
            Instalar
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowHelp((value) => !value)}
            className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-zinc-950"
          >
            Como instalar
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar"
          className="rounded-lg px-2 py-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function InstallAppButton({
  variant = "dark",
}: {
  variant?: "dark" | "light" | "nav" | "menu";
}) {
  const { canInstall, installed, promptInstall } = usePwaInstall();
  const [open, setOpen] = useState(false);

  if (installed) return null;

  const className =
    variant === "nav"
      ? "text-sm text-emerald-400 hover:text-emerald-300"
      : variant === "menu"
        ? "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] hover:bg-zinc-900"
        : variant === "dark"
          ? "mt-6 w-full rounded-full bg-white px-4 py-2.5 text-sm font-medium text-zinc-950"
          : "w-full rounded-xl px-3 py-3 text-left text-[15px] hover:bg-zinc-100";

  return (
    <div className={variant === "dark" ? "text-center" : ""}>
      <button
        type="button"
        onClick={() => {
          if (canInstall) void promptInstall();
          else setOpen(true);
        }}
        className={className}
      >
        {variant === "menu" && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-base">
            📲
          </span>
        )}
        Instalar aplicativo
      </button>
      {open && (
        <div className={variant === "nav" ? "absolute right-6 top-16 z-50 w-80" : "mt-3"}>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-left shadow-xl">
            <p className="text-sm font-medium text-white">Como instalar</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              No Chrome, use o botão Instalar do banner ou o ícone de app na barra de endereço. No iPhone, abra no Safari,
              toque em Compartilhar e depois em Adicionar à Tela de Início.
            </p>
            <button type="button" onClick={() => setOpen(false)} className="mt-3 text-xs text-emerald-400">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
