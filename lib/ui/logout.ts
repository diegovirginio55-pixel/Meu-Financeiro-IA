"use client";

import { createClient } from "@/lib/supabase/client";

const PUSH_CLEANUP_TIMEOUT_MS = 2500;

/**
 * Cancela a inscrição de push deste aparelho (servidor + navegador) para que as notificações
 * não continuem chegando depois de sair. Nunca lança erro e nunca demora mais que o timeout.
 */
export async function unsubscribePushBeforeLogout(timeoutMs = PUSH_CLEANUP_TIMEOUT_MS) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const cleanup = (async () => {
    // getRegistration() resolve na hora quando não há service worker (ex.: em desenvolvimento),
    // ao contrário de `ready`, que ficaria pendente para sempre.
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration || !("pushManager" in registration)) return;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    try {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
    } catch {
      /* segue para cancelar no navegador mesmo assim */
    }
    try {
      await subscription.unsubscribe();
    } catch {
      /* ignore */
    }
  })().catch(() => undefined);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  await Promise.race([cleanup, timeout]);
  if (timer) clearTimeout(timer);
}

/** Sai da conta: cancela o push (sem travar se falhar) e encerra a sessão do Supabase. */
export async function logout() {
  await unsubscribePushBeforeLogout();
  const supabase = createClient();
  await supabase.auth.signOut();
}
