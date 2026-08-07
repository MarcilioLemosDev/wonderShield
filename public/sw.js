// Service worker do wonderblue. Objetivo modesto e seguro: deixar o app
// instalável e resistente a quedas de rede — sem nunca cachear o que é privado.
//
// Regras de ouro:
//   • só mexe em GET do mesmo domínio;
//   • NUNCA toca em /api/* nem em chamadas ao Supabase (dados vivos e sessão);
//   • navegação: rede primeiro, cai pro cache/offline se faltar conexão;
//   • estático: cache com atualização em segundo plano (stale-while-revalidate).
const CACHE = "wonderblue-v1";
const APP_SHELL = ["/feed", "/login", "/offline", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // só o próprio domínio; deixa Supabase/terceiros passarem direto
  if (url.origin !== self.location.origin) return;
  // nada de API: são dados vivos e sessão, jamais em cache
  if (url.pathname.startsWith("/api/")) return;

  // navegação (abrir uma página): rede primeiro, offline como rede de segurança
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/offline"))),
    );
    return;
  }

  // estático do mesmo domínio: responde do cache e revalida em segundo plano
  event.respondWith(
    caches.match(req).then((cacheado) => {
      const rede = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return res;
        })
        .catch(() => cacheado);
      return cacheado || rede;
    }),
  );
});
