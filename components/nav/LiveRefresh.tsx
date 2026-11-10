"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Intervalo mínimo entre duas recargas (vários avisos seguidos viram uma só). */
const MIN_GAP_MS = 4000;
/** Voltou para o app depois de pelo menos isso fora: recarrega os dados. */
const STALE_AFTER_HIDDEN_MS = 15_000;

/**
 * Tela sempre com o saldo do momento: quando chega uma notificação do app
 * (o service worker avisa as janelas abertas) ou quando o usuário volta para
 * o app depois de usar o app do banco, os dados da tela são recarregados —
 * sem precisar puxar para atualizar.
 */
export default function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    let lastRefresh = 0;
    let hiddenAt = 0;
    let timer: number | null = null;

    function refreshSoon() {
      if (timer != null) return;
      const wait = Math.max(0, lastRefresh + MIN_GAP_MS - Date.now());
      timer = window.setTimeout(() => {
        timer = null;
        lastRefresh = Date.now();
        router.refresh();
      }, wait);
    }

    function onMessage(event: MessageEvent) {
      if ((event.data as { type?: string } | null)?.type === "mf:push-received") refreshSoon();
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt >= STALE_AFTER_HIDDEN_MS) refreshSoon();
      hiddenAt = 0;
    }

    const worker = "serviceWorker" in navigator ? navigator.serviceWorker : null;
    worker?.addEventListener("message", onMessage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      worker?.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer != null) window.clearTimeout(timer);
    };
  }, [router]);

  return null;
}
