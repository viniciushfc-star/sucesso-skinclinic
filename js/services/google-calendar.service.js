/**
 * Serviço para sincronização Google Calendar (status, sync, disconnect, URL de conexão).
 */

import { getActiveOrg } from "../core/org.js";
import { apiFetch } from "../core/api-fetch.js";

/**
 * Obtém URL OAuth (JWT no header). userId da UI não é enviado — o backend usa o JWT.
 */
export async function startGoogleCalendarConnect() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização não selecionada");
  const res = await apiFetch(`/api/google-calendar/auth?orgId=${encodeURIComponent(orgId)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) throw new Error(data.error || "Não foi possível iniciar a conexão Google");
  window.location.href = data.url;
}

/** @deprecated Use startGoogleCalendarConnect */
export function getConnectUrl() {
  const orgId = getActiveOrg();
  if (!orgId) return null;
  return "#google-calendar-connect";
}

export async function getCalendarConnectionsStatus() {
  const orgId = getActiveOrg();
  if (!orgId) return { connections: [] };

  try {
    const res = await apiFetch(`/api/google-calendar/status?orgId=${encodeURIComponent(orgId)}`);
    if (!res.ok) return { connections: [] };
    return await res.json();
  } catch (_) {
    return { connections: [] };
  }
}

export async function syncCalendar(userId = null) {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização não selecionada");

  const body = userId ? { orgId, userId } : { orgId };
  const res = await apiFetch("/api/google-calendar/sync", { method: "POST", json: body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro ao sincronizar");
  return data;
}

export async function occupyProfessionalCalendar(agendaId, action = "occupy") {
  if (!agendaId) return { skipped: true };
  const res = await apiFetch("/api/google-calendar/occupy", {
    method: "POST",
    json: { agenda_id: agendaId, action },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, skipped: true };
  return data;
}

export async function disconnectCalendar(userId) {
  const orgId = getActiveOrg();
  if (!orgId || !userId) throw new Error("Dados insuficientes");

  const res = await apiFetch("/api/google-calendar/disconnect", {
    method: "POST",
    json: { orgId, userId },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro ao desconectar");
  return data;
}
