/**
 * Afazeres — tarefas com responsável e prazo; não ocupam agenda.
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/**
 * Tipos de afazeres disponíveis
 */
export const TIPOS_AFAZERES = {
  geral: "Geral",
  atendimento_remoto: "Atendimento remoto",
  conferencia_estoque: "Conferência de estoque",
  administrativa: "Administrativa",
  skincare_remoto: "Skincare remoto",
  outro: "Outro",
};

export async function listAfazeres(filters = {}) {
  let q = withOrg(
    supabase.from("afazeres").select("*").order("prazo", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false })
  );
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.responsavelUserId) q = q.eq("responsavel_user_id", filters.responsavelUserId);
  if (filters.tipo) q = q.eq("tipo", filters.tipo);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/**
 * Afazeres com prazo em uma data (para mostrar na agenda do dia; não ocupam horário).
 * @param {string} prazoDate - YYYY-MM-DD
 * @param {{ responsavelUserId?: string }} options - opcional: filtrar por responsável
 * @returns {Promise<Array>}
 */
export async function listAfazeresByPrazo(prazoDate, options = {}) {
  if (!prazoDate) return [];
  let q = withOrg(
    supabase.from("afazeres").select("*").eq("prazo", prazoDate).neq("status", "cancelado").order("created_at", { ascending: false })
  );
  if (options.responsavelUserId) q = q.eq("responsavel_user_id", options.responsavelUserId);
  const { data, error } = await q;
  if (error) return [];
  return data ?? [];
}

export async function createAfazer({ responsavelUserId, titulo, descricao, prazo, tipo }) {
  const orgId = getOrgOrThrow();
  const { data, error } = await supabase
    .from("afazeres")
    .insert({
      org_id: orgId,
      responsavel_user_id: responsavelUserId || null,
      titulo: (titulo || "").trim(),
      descricao: (descricao || "").trim() || null,
      prazo: prazo || null,
      tipo: tipo || "geral",
      status: "pendente",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateAfazer(id, { responsavelUserId, titulo, descricao, prazo, tipo, status }) {
  const payload = {};
  if (responsavelUserId !== undefined) payload.responsavel_user_id = responsavelUserId || null;
  if (titulo !== undefined) payload.titulo = (titulo || "").trim();
  if (descricao !== undefined) payload.descricao = (descricao || "").trim() || null;
  if (prazo !== undefined) payload.prazo = prazo || null;
  if (tipo !== undefined) payload.tipo = tipo || "geral";
  if (status !== undefined) payload.status = status;
  const { data, error } = await withOrg(
    supabase.from("afazeres").update(payload).eq("id", id).select().single()
  );
  if (error) throw error;
  return data;
}

export async function deleteAfazer(id) {
  const { error } = await withOrg(supabase.from("afazeres").delete().eq("id", id));
  if (error) throw error;
}

/**
 * Resumo de tarefas por responsável: total e concluídas.
 * @returns {Promise<Array<{ user_id: string, total: number, concluidos: number }>>}
 */
export async function getAfazeresResumoPorUsuario() {
  const { data, error } = await withOrg(
    supabase.from("afazeres").select("responsavel_user_id, status")
  );
  if (error) return [];
  const byUser = {};
  for (const row of data || []) {
    const uid = row.responsavel_user_id || "_sem_responsavel_";
    if (!byUser[uid]) byUser[uid] = { total: 0, concluidos: 0 };
    byUser[uid].total += 1;
    if (row.status === "concluido") byUser[uid].concluidos += 1;
  }
  return Object.entries(byUser)
    .filter(([uid]) => uid !== "_sem_responsavel_")
    .map(([user_id, o]) => ({ user_id, total: o.total, concluidos: o.concluidos }));
}
