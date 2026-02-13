/**
 * Serviço para sincronização Google Calendar (status, sync, disconnect, URL de conexão).
 * As rotas /api/google-calendar/* devem estar disponíveis e configuradas (GOOGLE_CLIENT_ID, etc.).
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";
import { getApiBase } from "../core/api-base.js";

/**
 * Retorna a URL para iniciar OAuth (redireciona o usuário para Google).
 */
export function getConnectUrl(userId) {
  const orgId = getActiveOrg();
  if (!orgId || !userId) return null;
  const base = getApiBase();
  return `${base}/api/google-calendar/auth?userId=${encodeURIComponent(userId)}&orgId=${encodeURIComponent(orgId)}`;
}

/**
 * Lista conexões Google da org (user_id e last_sync_at). Não expõe tokens.
 */
export async function getCalendarConnectionsStatus() {
  const orgId = getActiveOrg();
  if (!orgId) return { connections: [] };
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { connections: [] };

  try {
    const res = await fetch(`${getApiBase()}/api/google-calendar/status?orgId=${encodeURIComponent(orgId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { connections: [] };
    const data = await res.json();
    return data;
  } catch (_) {
    return { connections: [] };
  }
}

/**
 * Sincroniza a agenda Google do profissional com external_calendar_blocks.
 */
export async function syncCalendar(userId = null) {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização não selecionada");
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Faça login para sincronizar");

  const body = userId ? { orgId, userId } : { orgId };
  const res = await fetch(`${getApiBase()}/api/google-calendar/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro ao sincronizar");
  return data;
}

/**
 * Remove a conexão Google Calendar do usuário.
 */
export async function disconnectCalendar(userId) {
  const orgId = getActiveOrg();
  if (!orgId || !userId) throw new Error("Dados insuficientes");
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Faça login para desconectar");

  const res = await fetch(`${getApiBase()}/api/google-calendar/disconnect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ orgId, userId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro ao desconectar");
  return data;
}
