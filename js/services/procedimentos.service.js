import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/**
 * Busca um procedimento por ID (para obter tipo_procedimento, valor_cobrado no agendamento/dar baixa).
 */
export async function getProcedure(id) {
  if (!id) return null;
  const orgId = getOrgOrThrow();
  const { data, error } = await supabase
    .from("procedures")
    .select("id, name, duration_minutes, tipo_procedimento, valor_cobrado")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();
  if (error || !data) return null;
  return data;
}

/**
 * Lista categorias de procedimento da organização.
 */
export async function listProcedureCategories() {
  const orgId = getOrgOrThrow();
  const { data, error } = await withOrg(
    supabase.from("procedure_categories").select("id, name").order("name")
  );
  if (error) throw error;
  return data ?? [];
}

/**
 * Lista procedimentos da organização (tipos de serviço).
 * @param {boolean} activeOnly - se true, só retorna ativos
 */
export async function listProcedures(activeOnly = false) {
  const orgId = getOrgOrThrow();
  const fullSelect = "id, name, description, duration_minutes, valor_cobrado, active, codigo, category_id, custo_material_estimado, margem_minima_desejada, tipo_procedimento, termo_especifico, created_at";
  let q = withOrg(supabase.from("procedures").select(fullSelect).order("name"));
  if (activeOnly) q = q.eq("active", true);
  let { data, error } = await q;
  if (error) {
    q = withOrg(supabase.from("procedures").select("id, name, description, duration_minutes, valor_cobrado, active, tipo_procedimento, created_at").order("name"));
    if (activeOnly) q = q.eq("active", true);
    const fallback = await q;
    if (fallback.error) throw fallback.error;
    return fallback.data ?? [];
  }
  return data ?? [];
}

/**
 * Cria uma categoria de procedimento.
 */
export async function createProcedureCategory(name) {
  const orgId = getOrgOrThrow();
  const n = (name || "").trim();
  if (!n) throw new Error("Nome da categoria é obrigatório");
  const { data, error } = await supabase.from("procedure_categories").insert({ org_id: orgId, name: n }).select().single();
  if (error) throw error;
  return data;
}

/**
 * Cria um procedimento.
 */
export async function createProcedure({ name, description, durationMinutes = 60, valorCobrado, codigo, categoryId, custoMaterialEstimado, margemMinimaDesejada, tipoProcedimento, termoEspecifico }) {
  const orgId = getOrgOrThrow();
  const payload = {
    org_id: orgId,
    name: (name || "").trim(),
    duration_minutes: Number(durationMinutes) || 60,
    active: true,
  };
  if (description !== undefined) payload.description = (description || "").trim() || null;
  if (valorCobrado !== undefined && valorCobrado !== "" && valorCobrado !== null) payload.valor_cobrado = Number(valorCobrado);
  if (codigo !== undefined && codigo !== "") payload.codigo = (codigo || "").trim() || null;
  if (categoryId !== undefined && categoryId !== "") payload.category_id = categoryId || null;
  if (custoMaterialEstimado !== undefined && custoMaterialEstimado !== "") payload.custo_material_estimado = custoMaterialEstimado == null ? null : Number(custoMaterialEstimado);
  if (margemMinimaDesejada !== undefined && margemMinimaDesejada !== "") payload.margem_minima_desejada = margemMinimaDesejada == null ? null : Number(margemMinimaDesejada);
  if (tipoProcedimento !== undefined && tipoProcedimento !== "") payload.tipo_procedimento = (tipoProcedimento || "").trim() || null;
  if (termoEspecifico !== undefined) payload.termo_especifico = (termoEspecifico || "").trim() || null;
  const { data, error } = await supabase.from("procedures").insert(payload).select().single();
  if (error) throw error;
  return data;
}

/**
 * Atualiza um procedimento.
 */
export async function updateProcedure(id, { name, description, durationMinutes, valorCobrado, active, codigo, categoryId, custoMaterialEstimado, margemMinimaDesejada, tipoProcedimento, termoEspecifico }) {
  const orgId = getOrgOrThrow();
  const payload = {};
  if (name !== undefined) payload.name = (name || "").trim();
  if (description !== undefined) payload.description = (description || "").trim() || null;
  if (durationMinutes !== undefined) payload.duration_minutes = Number(durationMinutes) || 60;
  if (valorCobrado !== undefined) payload.valor_cobrado = valorCobrado === "" || valorCobrado === null ? null : Number(valorCobrado);
  if (active !== undefined) payload.active = Boolean(active);
  if (codigo !== undefined) payload.codigo = (codigo || "").trim() || null;
  if (categoryId !== undefined) payload.category_id = categoryId || null;
  if (custoMaterialEstimado !== undefined) payload.custo_material_estimado = custoMaterialEstimado === "" || custoMaterialEstimado === null ? null : Number(custoMaterialEstimado);
  if (margemMinimaDesejada !== undefined) payload.margem_minima_desejada = margemMinimaDesejada === "" || margemMinimaDesejada === null ? null : Number(margemMinimaDesejada);
  if (tipoProcedimento !== undefined) payload.tipo_procedimento = (tipoProcedimento || "").trim() || null;
  if (termoEspecifico !== undefined) payload.termo_especifico = (termoEspecifico || "").trim() || null;
  const { data, error } = await supabase
    .from("procedures")
    .update(payload)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Remove um procedimento (ou desativa).
 */
export async function deleteProcedure(id) {
  const orgId = getOrgOrThrow();
  const { error } = await supabase
    .from("procedures")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) throw error;
}
