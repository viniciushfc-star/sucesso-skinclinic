import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { getFinanceiro } from "./financeiro.service.js";
import {
  parsePeriodoRef,
  monthBounds,
  realizadoFromLancamentos,
  explainMetaRitmo,
} from "../utils/meta-ritmo.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

const TIPOS_META = ["reserva_emergencia", "receita_mensal", "lucro_mensal", "outro"];

export async function listFinanceiroMetas() {
  const { data, error } = await withOrg(
    supabase.from("financeiro_metas").select("*").order("tipo").order("periodo_ref", { ascending: false })
  );
  if (error) throw error;
  return data ?? [];
}

function defaultPeriodo(tipo, periodoRef) {
  let periodo = (periodoRef || "").trim() || null;
  if (!periodo && (tipo === "receita_mensal" || tipo === "lucro_mensal")) {
    const now = new Date();
    periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  return periodo;
}

export async function createFinanceiroMeta({ tipo, valorMeta, periodoRef, observacao }) {
  const orgId = getOrgOrThrow();
  if (!TIPOS_META.includes(tipo)) throw new Error("Tipo de meta inválido");
  const { data, error } = await supabase
    .from("financeiro_metas")
    .insert({
      org_id: orgId,
      tipo,
      valor_meta: Number(valorMeta),
      periodo_ref: defaultPeriodo(tipo, periodoRef),
      observacao: (observacao || "").trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

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

export async function deleteFinanceiroMeta(id) {
  const { error } = await withOrg(supabase.from("financeiro_metas").delete().eq("id", id));
  if (error) throw error;
}

/**
 * Metas com realizado (financeiro do período), ritmo e projeção.
 * Reserva/outro: realizado = saldo de caixa atual, sem ritmo diário.
 */
export async function explainFinanceiroMetas({ saldoAtual = null, asOf = new Date() } = {}) {
  const [metas, lancamentos] = await Promise.all([
    listFinanceiroMetas(),
    getFinanceiro().catch(() => []),
  ]);
  return (metas || []).map((m) => {
    const { year, month } = parsePeriodoRef(m.periodo_ref, asOf);
    const { start, end } = monthBounds(year, month);
    let realizado = realizadoFromLancamentos(m.tipo, lancamentos, start, end);
    if (realizado == null && (m.tipo === "reserva_emergencia" || m.tipo === "outro")) {
      realizado = saldoAtual == null ? null : Number(saldoAtual);
    }
    const ritmo = explainMetaRitmo({
      tipo: m.tipo,
      valorMeta: m.valor_meta,
      realizado,
      year,
      month,
      asOf,
    });
    return { ...m, year, month, start, end, ritmo };
  });
}

export { TIPOS_META };
