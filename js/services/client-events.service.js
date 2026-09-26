import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/**
 * Lista eventos de um cliente (linha do tempo) — ordem cronológica
 */
export async function getEventsByClient(clientId) {
  if (!clientId) throw new Error("Cliente inválido");
  const orgId = getOrgOrThrow();

  const { data, error } = await supabase
    .from("client_events")
    .select("*")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Registra um evento (Evento ≠ Decisão ≠ Execução)
 * @param {Object} payload - client_id, event_type, description, event_date?, created_by_client?, is_critical?
 */
export async function createClientEvent({
  client_id,
  event_type,
  description,
  event_date,
  created_by_client = false,
  is_critical = false,
  metadata = {},
}) {
  if (!client_id) throw new Error("Cliente inválido");
  if (!event_type) throw new Error("Tipo de evento obrigatório");
  const orgId = getOrgOrThrow();

  const { data: userData } = await supabase.auth.getUser();
  const created_by_user_id = userData?.user?.id || null;

  let { data, error } = await supabase
    .from("client_events")
    .insert({
      org_id: orgId,
      client_id,
      event_type,
      description: description || null,
      event_date: event_date || new Date().toISOString().slice(0, 10),
      created_by_user_id,
      created_by_client: !!created_by_client,
      is_critical: !!is_critical,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error && /metadata|schema cache|column/i.test(String(error.message || ""))) {
    const retry = await supabase
      .from("client_events")
      .insert({
        org_id: orgId,
        client_id,
        event_type,
        description: description || null,
        event_date: event_date || new Date().toISOString().slice(0, 10),
        created_by_user_id,
        created_by_client: !!created_by_client,
        is_critical: !!is_critical,
      })
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  return data;
}

/**
 * Desfechos da fila CRM (tabela client_events, sem crm2).
 */
export async function listCrmDesfechosRecentes(days = 45) {
  const orgId = getOrgOrThrow();
  const n = Math.max(7, Number(days) || 45);
  const from = new Date();
  from.setDate(from.getDate() - n);
  const fromIso = from.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("client_events")
    .select("client_id, event_type, event_date, description, metadata")
    .eq("org_id", orgId)
    .eq("event_type", "crm_desfecho")
    .gte("event_date", fromIso)
    .order("event_date", { ascending: false })
    .limit(400);
  if (error) return [];
  return data || [];
}
