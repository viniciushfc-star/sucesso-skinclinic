/**
 * Base URL para chamadas à API do servidor (rotas /api/*).
 * Em localhost/127.0.0.1 sempre usa porta 3000, onde o Node sobe com npm start.
 * Assim o app funciona mesmo se aberto por Live Server (5500) ou outro servidor estático.
 */
export function getApiBase() {
  if (typeof window === "undefined") return "";
  const o = window.location;
  const origin = o.origin || "";
  const isLocal = o.hostname === "localhost" || o.hostname === "127.0.0.1";
  if (isLocal) return "http://localhost:3000";
  return origin.replace(/\/$/, "");
}
