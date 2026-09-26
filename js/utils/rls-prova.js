/**
 * Prova RLS contínua: casos A≠B (tabelas, RPC do portal, Storage).
 * Não grava. Token lixo não pode devolver paciente.
 */

export const SIGNED_TTL_MAX = 3600;

export const RLS_TABLES = [
  "clients",
  "agenda",
  "financeiro",
  "estoque_entradas",
  "protocolos_aplicados",
  "analise_pele",
  "client_sessions",
  "audit_logs",
  "organization_invites",
  "profiles",
  "ocr_notas",
  "market_radar_refs",
  "lgpd_requests",
  "api_error_events",
  "agenda_google_events",
  "google_calendar_connections",
  "whatsapp_logs",
  "ai_usage_events",
  "client_events",
  "anamnesis_registros",
  "orcamentos",
  "estoque_produtos",
  "client_packages",
  "package_consumptions",
  "estoque_consumo",
  "agenda_waitlist",
];

export const RLS_TABLES_OPTIONAL = new Set([
  "ocr_notas",
  "market_radar_refs",
  "lgpd_requests",
  "api_error_events",
  "agenda_google_events",
  "google_calendar_connections",
  "whatsapp_logs",
  "ai_usage_events",
  "client_events",
  "anamnesis_registros",
  "orcamentos",
  "estoque_produtos",
  "client_packages",
  "package_consumptions",
  "estoque_consumo",
  "agenda_waitlist",
]);

export const RLS_BUCKETS = ["analise-pele-fotos", "client-photos", "anamnese-fotos"];

export const PORTAL_RPCS = [
  "get_client_session_by_token",
  "get_client_by_token",
  "get_analises_pele_by_token",
];

export function clampSignedTtl(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return SIGNED_TTL_MAX;
  return Math.min(Math.floor(n), SIGNED_TTL_MAX);
}

export function rpcPortalVazou(data) {
  if (data == null) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === "object") return Object.keys(data).length > 0;
  return false;
}

export function rpcPortalTemPreliminar(data) {
  try {
    return /ia_preliminar/i.test(JSON.stringify(data || ""));
  } catch {
    return false;
  }
}

export function interpretarRpcPortal({ data, error } = {}) {
  if (rpcPortalTemPreliminar(data)) {
    return { ok: false, detalhe: "RPC expôs ia_preliminar" };
  }
  if (rpcPortalVazou(data)) {
    return { ok: false, detalhe: "RPC devolveu dado com token lixo" };
  }
  return { ok: true, detalhe: error ? `vazio/erro ${error.code || ""}` : "sem sessão" };
}
