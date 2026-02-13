const CACHE = "skinclinic-v3"

self.addEventListener("install", (e) => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll([
        "/",
        "/index.html",
        "/onboarding.html",
        "/dashboard.html",
        "/js/css/style.css",
      ])
    )
  )
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url)

  // Nunca cachear Supabase nem APIs externas – sempre rede
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname !== self.location.hostname
  ) {
    e.respondWith(fetch(e.request))
    return
  }

  // Para HTML e JS do app: rede primeiro, cache só se falhar (offline)
  if (
    e.request.mode === "navigate" ||
    e.request.destination === "script" ||
    e.request.destination === "document"
  ) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    )
    return
  }

  // CSS e outros: cache primeiro, depois rede
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  )
})
