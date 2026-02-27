/**
 * Motor de regras e score por tipo de anamnese (injetáveis, corporal, simples).
 * Regras em JSON: contraindicação absoluta/relativa, alerta, bloqueio de procedimento.
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";

const NIVEL_ORDEM = {
  contraindicacao_absoluta: 0,
  contraindicacao_relativa: 1,
  alerta: 2,
  info: 3
};

/**
 * Avalia uma condição contra o objeto de dados (ficha + anthropometry).
 * @param {Object} cond - { field: "ficha.gestante", op: "eq"|"ne"|"in"|"gt"|"gte"|"lt"|"lte"|"present", value }
 * @param {Object} data - { ficha: {...}, anthropometry?: {...} }
 */
function evalCondition(cond, data) {
  if (!cond || !cond.field) return false;
  const value = getByPath(data, cond.field);
  const op = (cond.op || "eq").toLowerCase();
  const target = cond.value;

  switch (op) {
    case "eq":
      return value === target || String(value).toLowerCase() === String(target).toLowerCase();
    case "ne":
      return value !== target && String(value).toLowerCase() !== String(target).toLowerCase();
    case "in":
      return Array.isArray(target) && target.includes(value);
    case "present":
      return value != null && String(value).trim() !== "";
    case "absent":
      return value == null || String(value).trim() === "";
    case "gt":
      return Number(value) > Number(target);
    case "gte":
      return Number(value) >= Number(target);
    case "lt":
      return Number(value) < Number(target);
    case "lte":
      return Number(value) <= Number(target);
    default:
      return false;
  }
}

function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let v = obj;
  for (const p of parts) {
    v = v?.[p];
  }
  return v;
}

/**
 * Lista regras ativas para um tipo de anamnese.
 */
export async function listRegrasByTipo(tipoId) {
  const orgId = getActiveOrg();
  if (!orgId) return [];
  const { data, error } = await withOrg(
    supabase
      .from("anamnesis_regras")
      .select("id, nome, nivel, bloqueia_procedimento, regra, ordem")
      .eq("org_id", orgId)
      .eq("tipo_id", tipoId)
      .eq("active", true)
      .order("ordem")
  );
  if (error) throw error;
  return data ?? [];
}

/**
 * Avalia todas as regras do tipo contra ficha + anthropometry.
 * Retorna: { score, nivelPior, bloqueio, alertas, detalhes }.
 * score: 0 = ok, 1 = info, 2 = alerta, 3 = relativa, 4 = absoluta.
 */
export function evaluateRegras(regras, data) {
  const detalhes = [];
  let nivelPior = "info";
  let bloqueio = false;

  for (const r of regras || []) {
    const conditions = r.regra?.conditions ?? (r.regra?.condition ? [r.regra.condition] : []);
    const match = conditions.length === 0 || conditions.every((c) => evalCondition(c, data));
    if (!match) continue;

    const message = r.regra?.message || r.nome || "Regra acionada";
    detalhes.push({ nivel: r.nivel, message, bloqueia: r.bloqueia_procedimento });

    if (NIVEL_ORDEM[r.nivel] < NIVEL_ORDEM[nivelPior]) nivelPior = r.nivel;
    if (r.bloqueia_procedimento) bloqueio = true;
  }

  const scoreByNivel = { contraindicacao_absoluta: 4, contraindicacao_relativa: 3, alerta: 2, info: 1 };
  const score = nivelPior ? scoreByNivel[nivelPior] ?? 1 : 0;

  return {
    score,
    nivelPior: nivelPior === "info" ? null : nivelPior,
    bloqueio,
    alertas: detalhes,
    detalhes
  };
}

/**
 * Fluxo completo: carrega regras do tipo, avalia dados, retorna resultado para persistir em score_result.
 */
export async function runScoreEngine(tipoId, data) {
  const regras = await listRegrasByTipo(tipoId);
  const result = evaluateRegras(regras, data);
  return {
    ...result,
    evaluated_at: new Date().toISOString(),
    tipo_id: tipoId
  };
}
