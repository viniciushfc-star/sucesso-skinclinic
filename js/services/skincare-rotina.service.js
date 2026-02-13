/**
 * Rotina de skincare por cliente — dashboard clínica.
 * Uma rotina ativa por cliente; clínica edita e libera no portal (monetização).
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";

function getOrgId() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/**
 * Busca a rotina de skincare do cliente (se existir).
 * @param {string} clientId
 * @returns {Promise<{ id, conteudo, liberado_em, created_at, updated_at } | null>}
 */
export async function getSkincareRotinaByClient(clientId) {
  const orgId = getOrgId();
  const { data, error } = await supabase
    .from("skincare_rotinas")
    .select("id, conteudo, liberado_em, created_at, updated_at")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Cria ou atualiza a rotina do cliente e opcionalmente libera no portal.
 * @param {string} clientId
 * @param {{ conteudo: string, liberar?: boolean }} payload
 */
export async function upsertSkincareRotina(clientId, payload) {
  const orgId = getOrgId();
  const { conteudo = "", liberar = false } = payload || {};
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("skincare_rotinas")
    .select("id")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (existing?.id) {
    const update = {
      conteudo: conteudo.trim() || "",
      updated_at: now,
      ...(liberar ? { liberado_em: now } : {}),
    };
    const { error } = await supabase
      .from("skincare_rotinas")
      .update(update)
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("skincare_rotinas").insert({
    org_id: orgId,
    client_id: clientId,
    conteudo: conteudo.trim() || "",
    liberado_em: liberar ? now : null,
    updated_at: now,
  });
  if (error) throw error;
}

/**
 * Marca a rotina como liberada no portal (cliente poderá ver).
 * @param {string} clientId
 */
export async function liberarSkincareRotina(clientId) {
  const orgId = getOrgId();
  const now = new Date().toISOString();
  const { data: row } = await supabase
    .from("skincare_rotinas")
    .select("id")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!row) {
    throw new Error("Salve uma rotina antes de liberar no portal.");
  }
  const { error } = await supabase
    .from("skincare_rotinas")
    .update({ liberado_em: now, updated_at: now })
    .eq("id", row.id);
  if (error) throw error;
}
