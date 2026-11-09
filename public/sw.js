const CACHE = "financeiro-shell-v11";
const SHELL = [
  "/logo.png?v=2",
  "/icon-192.png?v=2",
  "/icon-512.png?v=2",
  "/apple-touch-icon.png?v=2",
  "/icons/icon-512-maskable.png",
];
const SHELL_PATHS = new Set(SHELL.map((item) => item.split("?")[0]));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Página mínima exibida quando a navegação falha por falta de rede. Não é cache de HTML do app
// (nada autenticado fica guardado): é gerada aqui mesmo, só no caso de erro.
const OFFLINE_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#09090b">
<title>Sem conexão — Meu Financeiro IA</title>
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; height: 100%; background: #09090b; color: #f4f4f5;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 12px; padding: 24px; text-align: center; box-sizing: border-box; }
  img { width: 72px; height: 72px; border-radius: 18px; }
  h1 { margin: 8px 0 0; font-size: 22px; font-weight: 600; }
  p { margin: 0; max-width: 320px; color: #a1a1aa; font-size: 15px; line-height: 1.5; }
  button { margin-top: 12px; border: 0; border-radius: 999px; background: #10b981; color: #09090b;
    font-size: 16px; font-weight: 600; padding: 12px 24px; cursor: pointer; }
</style>
</head>
<body>
<main>
  <img src="/icon-192.png?v=2" alt="">
  <h1>Sem conexão</h1>
  <p>Não foi possível carregar esta página. Verifique sua internet e tente de novo.</p>
  <button type="button" onclick="location.reload()">Tentar de novo</button>
</main>
</body>
</html>`;

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    statusText: "Offline",
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    // HTML nunca é cacheado (é autenticado); sem rede, mostra a página "Sem conexão".
    event.respondWith(fetch(request, { cache: "no-store" }).catch(() => offlineResponse()));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && SHELL_PATHS.has(url.pathname)) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error())),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Meu Financeiro IA", body: "Nova movimentação na conta.", url: "/detalhes" };
  try {
    payload = { ...payload, ...(event.data?.json() ?? {}) };
  } catch {
    const text = event.data?.text();
    if (text) payload.body = text;
  }
  const url = payload.url || "/detalhes";
  // Tag única por padrão: notificações seguidas aparecem todas (não substituem a anterior).
  // Se o servidor mandar uma tag, a nova substitui a antiga e avisa de novo (renotify).
  const tag = payload.tag || `mf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/icon-192.png?v=2",
        badge: "/icon-192.png?v=2",
        tag,
        renotify: true,
        data: { url },
      }),
      // Avisa as janelas abertas para recarregarem a lista de notificações na hora.
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((windowClients) => {
          windowClients.forEach((client) => client.postMessage({ type: "mf:push-received", url }));
        })
        .catch(() => undefined),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/detalhes";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((client) => "focus" in client);
      if (!existing) return self.clients.openWindow(target);
      // Primeiro traz a janela para frente, depois navega (navigate antes de focus falha em alguns navegadores).
      return existing
        .focus()
        .catch(() => existing)
        .then((focused) => {
          const client = focused || existing;
          if (!client.navigate) return client;
          return client.navigate(target).catch(() => self.clients.openWindow(target));
        });
    }),
  );
});
