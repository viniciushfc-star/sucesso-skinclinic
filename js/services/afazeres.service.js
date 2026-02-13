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
