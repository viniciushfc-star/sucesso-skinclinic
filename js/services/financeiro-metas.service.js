import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

const TIPOS_META = ["reserva_emergencia", "receita_mensal", "lucro_mensal", "outro"];

/**
 * Lista metas financeiras da organização (apenas master).
 */
export async function listFinanceiroMetas() {
  const { data, error } = await withOrg(
    supabase.from("financeiro_metas").select("*").order("tipo").order("periodo_ref", { ascending: false })
  );
  if (error) throw error;
  return data ?? [];
}

/**
 * Cria meta financeira (ex.: reserva de emergência R$ X).
 */
export async function createFinanceiroMeta({ tipo, valorMeta, periodoRef, observacao }) {
  const orgId = getOrgOrThrow();
  if (!TIPOS_META.includes(tipo)) throw new Error("Tipo de meta inválido");
  const { data, error } = await supabase
    .from("financeiro_metas")
    .insert({
      org_id: orgId,
      tipo,
      valor_meta: Number(valorMeta),
      periodo_ref: (periodoRef || "").trim() || null,
      observacao: (observacao || "").trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Atualiza meta.
 */
export async function updateFinanceiroMeta(id, { tipo, valorMeta, periodoRef, observacao }) {
  const payload = {};
  if (tipo !== undefined) payload.tipo = tipo;
  if (valorMeta !== undefined) payload.valor_meta = Number(valorMeta);
  if (periodoRef !== undefined) payload.periodo_ref = (periodoRef || "").trim() || null;
  if (observacao !== undefined) payload.observacao = (observacao || "").trim() || null;
  const { data, error } = await withOrg(
    supabase.from("financeiro_metas").update(payload).eq("id", id).select().single()
  );
  if (error) throw error;
  return data;
}

/**
 * Exclui meta.
 */
export async function deleteFinanceiroMeta(id) {
  const { error } = await withOrg(supabase.from("financeiro_metas").delete().eq("id", id));
  if (error) throw error;
}

export { TIPOS_META };
