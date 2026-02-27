/**
 * Base path para o app funcionar na raiz (/) ou em subpasta (ex.: /sucesso, /meu-app).
 * Quando você abre https://seusite.com/sucesso/dashboard.html, o pathname é /sucesso/dashboard.html
 * e o base fica /sucesso — assim todos os redirects usam /sucesso/index.html etc.
 */
function detectBase() {
  if (typeof window === "undefined") return ""
  const p = window.location.pathname || ""
  if (p === "" || p === "/") return ""
  if (p.endsWith("/")) return p.slice(0, -1)
  const parts = p.split("/").filter(Boolean)
  if (parts.length <= 1) return "" // ex.: /index.html → raiz
  parts.pop()
  return "/" + parts.join("/")
}

let cachedBase = null

export function getBase() {
  if (cachedBase !== null) return cachedBase
  cachedBase = (typeof window !== "undefined" && window.SKINCLINIC_BASE !== undefined)
    ? window.SKINCLINIC_BASE
    : detectBase()
  return cachedBase
}

/** Redireciona para um path (relativo à raiz do app). Ex.: redirect("/dashboard.html") */
export function redirect(path) {
  const base = getBase()
  const full = path.startsWith("http") ? path : base + (path.startsWith("/") ? path : "/" + path)
  window.location.href = full
}

/** Substitui a URL sem recarregar. Ex.: replace("/index.html#dashboard") */
export function replace(path) {
  const base = getBase()
  const full = path.startsWith("http") ? path : base + (path.startsWith("/") ? path : "/" + path)
  window.location.replace(full)
}

/** Retorna a URL completa para um path do app. Ex.: urlFor("/portal.html") */
export function urlFor(path) {
  const base = getBase()
  const p = path.startsWith("/") ? path : "/" + path
  return typeof window !== "undefined" ? window.location.origin + base + p : base + p
}
