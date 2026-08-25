const CACHE = "financeiro-shell-v10";
const SHELL = ["/logo.png?v=2", "/icon-192.png?v=2", "/icon-512.png?v=2", "/apple-touch-icon.png?v=2"];
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

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request, { cache: "no-store" }));
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
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png?v=2",
      badge: "/icon-192.png?v=2",
      data: { url: payload.url || "/detalhes" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/detalhes";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((client) => "focus" in client);
      if (existing && existing.navigate) return existing.navigate(target).then((client) => client.focus());
      if (existing) return existing.focus();
      return self.clients.openWindow(target);
    }),
  );
});
