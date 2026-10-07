// Service worker: guarda los archivos de la app para que abra sin conexión.
// Los datos de Supabase no pasan por aquí; app.js los guarda en el dispositivo.
const CACHE = "presupuesto-v3";   // súbelo en cada versión nueva (y el ?v= de index.html)
const ASSETS = [
  "./", "./index.html", "./styles.css?v=3", "./app.js?v=3", "./config.js?v=3", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(ASSETS.map((a) => c.add(a).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Red primero (con 3 s de espera máxima) y, si falla, la copia guardada.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.hostname.endsWith("supabase.co") || url.hostname.endsWith("supabase.in")) return;
  if (url.origin !== location.origin && url.hostname !== "cdn.jsdelivr.net") return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
    try {
      const res = await Promise.race([net, timeout]);
      if (res) return res;
    } catch { /* sin red */ }
    const cached = await cache.match(req, { ignoreSearch: true })
      || (req.mode === "navigate" && await cache.match("./index.html"));
    return cached || net;
  })());
});
