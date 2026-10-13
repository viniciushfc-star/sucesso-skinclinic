/**
 * Base URL para chamadas à API do servidor (rotas /api/*).
 * Se esta página já é o Node (3000/3001), usa a mesma origem — senão o link do portal
 * cai num servidor velho na outra porta.
 * Live Server / preview estático continua apontando para npm start na 3000.
 */
export function getApiBase() {
  if (typeof window === "undefined") return "";
  const o = window.location;
  const origin = (o.origin || "").replace(/\/$/, "");
  const isLocal = o.hostname === "localhost" || o.hostname === "127.0.0.1";
  if (!isLocal) return origin;
  const port = String(o.port || "");
  if (port === "5500" || port === "4173" || port === "8765") return "http://localhost:3000";
  if (port) return origin;
  return "http://localhost:3000";
}
