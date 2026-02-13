/**
 * Profissional × Procedimentos: quais procedimentos cada profissional realiza.
 * Usado no agendamento para filtrar profissionais que podem fazer o procedimento.
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/**
 * Lista IDs de procedimentos que o profissional realiza.
 * Se vazio, considera que pode fazer todos (comportamento antigo).
 */
export async function getProcedureIdsByProfessional(userId) {
  if (!userId) return [];
  const orgId = getOrgOrThrow();
  const { data, error } = await withOrg(
    supabase
      .from("professional_procedures")
      .select("procedure_id")
      .eq("user_id", userId)
  );
  if (error) throw error;
  return (data ?? []).map((r) => r.procedure_id);
}

/**
 * Define quais procedimentos o profissional realiza (substitui a lista).
 * @param {string} userId
 * @param {string[]} procedureIds - array de UUIDs
 */
export async function setProceduresForProfessional(userId, procedureIds) {
  const orgId = getOrgOrThrow();
  await supabase
    .from("professional_procedures")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (!Array.isArray(procedureIds) || procedureIds.length === 0) return [];
  const rows = procedureIds.filter(Boolean).map((procedure_id) => ({
    org_id: orgId,
    user_id: userId,
    procedure_id,
  }));
  const { data, error } = await supabase
    .from("professional_procedures")
    .insert(rows)
    .select("procedure_id");
  if (error) throw error;
  return data ?? [];
}

/**
 * Verifica se o profissional pode realizar o procedimento.
 * Se não houver nenhum registro em professional_procedures para ele, considera que pode todos.
 */
export async function professionalCanDoProcedure(userId, procedureId) {
  if (!userId || !procedureId) return true;
  const ids = await getProcedureIdsByProfessional(userId);
  if (ids.length === 0) return true; // nenhuma restrição = pode todos
  return ids.includes(procedureId);
}

/**
 * Lista user_ids dos profissionais que podem fazer o procedimento (ou todos se não houver restrições).
 * Para usar no agendamento: filtrar getAvailableProfessionals por esta lista.
 */
export async function getProfessionalIdsWhoCanDoProcedure(procedureId) {
  if (!procedureId) return null; // null = não filtrar
  const orgId = getOrgOrThrow();
  const { data, error } = await withOrg(
    supabase
      .from("professional_procedures")
      .select("user_id")
      .eq("procedure_id", procedureId)
  );
  if (error) throw error;
  const userIds = [...new Set((data ?? []).map((r) => r.user_id))];
  // Se nenhum profissional tem esse procedimento cadastrado, considera que todos podem (comportamento antigo)
  const { data: allMembers } = await withOrg(
    supabase.from("organization_users").select("user_id").eq("org_id", orgId)
  );
  const allUserIds = (allMembers ?? []).map((r) => r.user_id);
  if (userIds.length === 0) return allUserIds;
  return userIds;
}
