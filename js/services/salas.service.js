/**
 * Salas/Cabines — CRUD e listagem para agenda
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/**
 * Lista salas ativas da organização
 */
export async function listSalas(includeInactive = false) {
  let q = withOrg(
    supabase.from("salas").select("*").order("nome")
  );
  if (!includeInactive) q = q.eq("ativa", true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/**
 * Busca sala por ID
 */
export async function getSalaById(id) {
  const { data, error } = await withOrg(
    supabase.from("salas").select("*").eq("id", id).single()
  );
  if (error) throw error;
  return data;
}

/**
 * Cria nova sala
 * @param {Object} p - nome, descricao, procedimento_tipos (array de slugs: facial, corporal, capilar, injetaveis)
 */
export async function createSala({ nome, descricao, procedimento_tipos }) {
  const orgId = getOrgOrThrow();
  const payload = {
    org_id: orgId,
    nome: (nome || "").trim(),
    descricao: (descricao || "").trim() || null,
    ativa: true,
  };
  if (Array.isArray(procedimento_tipos)) payload.procedimento_tipos = procedimento_tipos;
  const { data, error } = await supabase.from("salas").insert(payload).select().single();
  if (error) throw error;
  return data;
}

/**
 * Atualiza sala
 * @param {Object} p - nome, descricao, ativa, procedimento_tipos (array)
 */
export async function updateSala(id, { nome, descricao, ativa, procedimento_tipos }) {
  const payload = {};
  if (nome !== undefined) payload.nome = (nome || "").trim();
  if (descricao !== undefined) payload.descricao = (descricao || "").trim() || null;
  if (ativa !== undefined) payload.ativa = ativa;
  if (procedimento_tipos !== undefined) payload.procedimento_tipos = Array.isArray(procedimento_tipos) ? procedimento_tipos : [];
  const { data, error } = await withOrg(
    supabase.from("salas").update(payload).eq("id", id).select().single()
  );
  if (error) throw error;
  return data;
}

/**
 * Desativa sala (soft delete)
 */
export async function desativarSala(id) {
  return updateSala(id, { ativa: false });
}

/**
 * Lista salas que suportam o tipo de procedimento (para filtrar no agendamento).
 * Se tipo for null/undefined, retorna todas as salas ativas.
 */
export async function listSalasQueSuportamTipo(tipoProcedimento) {
  const salas = await listSalas();
  if (!tipoProcedimento || tipoProcedimento.trim() === "") return salas;
  return salas.filter((s) => {
    const tipos = s.procedimento_tipos;
    if (!Array.isArray(tipos) || tipos.length === 0) return true;
    return tipos.includes(tipoProcedimento.trim());
  });
}
