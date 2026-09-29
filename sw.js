/**
 * Service Worker mínimo para PWA SkinClinic.
 * Cache de primeiras cargas para uso offline leve; atualização em segundo plano.
 */
const CACHE_NAME = "skinclinic-v7";
const ASSETS = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/js/css/style.css",
  "/js/core/supabase.js",
  "/js/core/auth.js",
  "/js/core/org.js",
  "/js/core/spa.js",
  "/js/core/bootstrap.js",
  "/js/ui/toast.js",
  "/js/ui/modal.js",
  "/manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const skipCache = /\/js\/(views|services|core|ui|utils)\//.test(url.pathname);
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (!skipCache && res.ok && (url.pathname.endsWith(".html") || url.pathname.endsWith(".css") || url.pathname.endsWith(".js"))) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      })
      .catch(() => (skipCache ? Promise.reject() : caches.match(event.request)))
  );
});
