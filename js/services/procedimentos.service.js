import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { retryUnknownColumns } from "../utils/supabase-unknown-col.js";
import { joinUsageRef, labelUnidadeQtd, qtyFromUsaRende, splitUsageRef } from "../utils/estoque-custo.js";

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
  const full =
    "id, name, duration_minutes, tipo_procedimento, valor_cobrado, custo_material_estimado, margem_minima_desejada, comissao_profissional_pct, aluguel_equipamento_dia, aluguel_horas_dia, aluguel_equipamento_nome";
  const basic = "id, name, duration_minutes, tipo_procedimento, valor_cobrado";
  let { data, error } = await supabase
    .from("procedures")
    .select(full)
    .eq("id", id)
    .eq("org_id", orgId)
    .single();
  if (error) {
    const fallback = await supabase
      .from("procedures")
      .select(basic)
      .eq("id", id)
      .eq("org_id", orgId)
      .single();
    data = fallback.data;
    error = fallback.error;
  }
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
  const fullSelect = "id, name, description, duration_minutes, valor_cobrado, active, codigo, category_id, custo_material_estimado, margem_minima_desejada, comissao_profissional_pct, tipo_procedimento, termo_especifico, aluguel_equipamento_dia, aluguel_horas_dia, aluguel_equipamento_nome, created_at";
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
export async function createProcedure({ name, description, durationMinutes = 60, valorCobrado, codigo, categoryId, custoMaterialEstimado, margemMinimaDesejada, comissaoProfissionalPct, tipoProcedimento, termoEspecifico, aluguelEquipamentoDia, aluguelHorasDia, aluguelEquipamentoNome }) {
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
  if (comissaoProfissionalPct !== undefined && comissaoProfissionalPct !== "") payload.comissao_profissional_pct = comissaoProfissionalPct == null ? null : Number(comissaoProfissionalPct);
  if (tipoProcedimento !== undefined && tipoProcedimento !== "") payload.tipo_procedimento = (tipoProcedimento || "").trim() || null;
  if (termoEspecifico !== undefined) payload.termo_especifico = (termoEspecifico || "").trim() || null;
  if (aluguelEquipamentoDia !== undefined) payload.aluguel_equipamento_dia = aluguelEquipamentoDia === "" || aluguelEquipamentoDia == null ? null : Number(aluguelEquipamentoDia);
  if (aluguelHorasDia !== undefined) payload.aluguel_horas_dia = aluguelHorasDia === "" || aluguelHorasDia == null ? null : Number(aluguelHorasDia);
  if (aluguelEquipamentoNome !== undefined) payload.aluguel_equipamento_nome = (aluguelEquipamentoNome || "").trim() || null;
  const { data, error } = await retryUnknownColumns(
    payload,
    (row) => supabase.from("procedures").insert(row).select().single(),
    { immutable: ["org_id", "name"] }
  );
  if (error) throw error;
  return data;
}

/**
 * Atualiza um procedimento.
 */
export async function updateProcedure(id, { name, description, durationMinutes, valorCobrado, active, codigo, categoryId, custoMaterialEstimado, margemMinimaDesejada, comissaoProfissionalPct, tipoProcedimento, termoEspecifico, aluguelEquipamentoDia, aluguelHorasDia, aluguelEquipamentoNome }) {
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
  if (comissaoProfissionalPct !== undefined) payload.comissao_profissional_pct = comissaoProfissionalPct === "" || comissaoProfissionalPct === null ? null : Number(comissaoProfissionalPct);
  if (tipoProcedimento !== undefined) payload.tipo_procedimento = (tipoProcedimento || "").trim() || null;
  if (termoEspecifico !== undefined) payload.termo_especifico = (termoEspecifico || "").trim() || null;
  if (aluguelEquipamentoDia !== undefined) payload.aluguel_equipamento_dia = aluguelEquipamentoDia === "" || aluguelEquipamentoDia == null ? null : Number(aluguelEquipamentoDia);
  if (aluguelHorasDia !== undefined) payload.aluguel_horas_dia = aluguelHorasDia === "" || aluguelHorasDia == null ? null : Number(aluguelHorasDia);
  if (aluguelEquipamentoNome !== undefined) payload.aluguel_equipamento_nome = (aluguelEquipamentoNome || "").trim() || null;
  const { data, error } = await retryUnknownColumns(
    payload,
    (row) =>
      supabase.from("procedures").update(row).eq("id", id).eq("org_id", orgId).select().single(),
    { immutable: ["name"] }
  );
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

/**
 * Materiais/produtos vinculados ao procedimento (procedure_stock_usage).
 * @param {string} procedureId
 * @returns {Promise<Array<{ item_ref: string, quantity_used: number }>>}
 */
export async function getProcedureStockUsage(procedureId) {
  if (!procedureId) return [];
  const { data, error } = await withOrg(
    supabase
      .from("procedure_stock_usage")
      .select("item_ref, quantity_used")
      .eq("procedure_id", procedureId)
  );
  if (error) return [];
  return (data ?? []).map((r) => {
    const parsed = splitUsageRef(r.item_ref);
    return {
      item_ref: (r.item_ref || "").trim(),
      quantity_used: Number(r.quantity_used) || 0,
      unidade: parsed.unidade,
      usa: parsed.usa,
      rende: parsed.rende,
    };
  });
}

export async function listAllProcedureStockUsage() {
  const { data, error } = await withOrg(
    supabase.from("procedure_stock_usage").select("procedure_id, item_ref, quantity_used")
  );
  if (error) return [];
  return data ?? [];
}

export const USAGE_VAGA_PREFIX = "vaga:";

export function isUsageVaga(itemRef) {
  const { nome } = splitUsageRef(itemRef);
  return nome.toLowerCase().startsWith(USAGE_VAGA_PREFIX);
}

export function usageDisplayName(itemRef) {
  const { nome, unidade, usa, rende } = splitUsageRef(itemRef);
  if (nome.toLowerCase().startsWith(USAGE_VAGA_PREFIX)) {
    const papel = nome.slice(USAGE_VAGA_PREFIX.length).trim() || "item";
    return `${papel} (profissional escolhe no dia)`;
  }
  if (usa && rende) {
    return `${nome} (${usa} ${labelUnidadeQtd(unidade, usa)} / ${rende} na embalagem)`;
  }
  if (unidade && unidade !== "un") return `${nome} (${labelUnidadeQtd(unidade)})`;
  return nome;
}

function missingUsageTable(error) {
  const msg = String(error?.message || "");
  const code = String(error?.code || "");
  return code === "42P01" || code === "PGRST205" || /procedure_stock_usage|does not exist|schema cache/i.test(msg);
}

/**
 * Substitui a receita de materiais do procedimento. Vaga (sem SKU) usa item_ref `vaga:mascara`.
 */
export async function replaceProcedureStockUsage(procedureId, items) {
  if (!procedureId) throw new Error("Procedimento inválido.");
  const orgId = getOrgOrThrow();
  const seen = new Set();
  const rows = [];
  for (const it of items || []) {
    const parsed = splitUsageRef(it.item_ref);
    const nome = parsed.nome;
    if (!nome || nome.toLowerCase().startsWith("aluguel:")) continue;
    const unidade = it.unidade || parsed.unidade;
    const usa = it.usa != null ? it.usa : parsed.usa;
    const rende = it.rende != null ? it.rende : parsed.rende;
    const ref = joinUsageRef(nome, unidade, usa, rende);
    const key = nome.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const frac = qtyFromUsaRende(usa, rende);
    const qty = frac != null ? frac : Number(it.quantity_used);
    rows.push({
      org_id: orgId,
      procedure_id: procedureId,
      item_ref: ref,
      quantity_used: Number.isFinite(qty) && qty > 0 ? qty : 1,
    });
  }
  const { error: delErr } = await supabase
    .from("procedure_stock_usage")
    .delete()
    .eq("procedure_id", procedureId)
    .eq("org_id", orgId);
  if (delErr) {
    if (missingUsageTable(delErr)) {
      throw new Error("A receita de materiais ainda não está no banco (procedure_stock_usage).");
    }
    throw delErr;
  }
  if (!rows.length) return [];
  const { data, error } = await supabase.from("procedure_stock_usage").insert(rows).select("item_ref, quantity_used");
  if (error) {
    if (missingUsageTable(error)) {
      throw new Error("A receita de materiais ainda não está no banco (procedure_stock_usage).");
    }
    throw error;
  }
  return data ?? rows;
}
