/**
 * Rateio de custo fixo no P&L do procedimento.
 * Padrão: não ratear. Nunca divide por atendimentos sem a clínica escolher esse método.
 * Sem denominador ou sem lançamentos → “não informado” (não inventa).
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { listSalas } from "./salas.service.js";

export const RATEIO_METODOS = [
  { id: "nao_ratear", label: "Não ratear (fica só no DRE da clínica)" },
  { id: "hora", label: "Por hora disponível" },
  { id: "atendimento", label: "Por atendimento realizado no mês" },
  { id: "sala", label: "Por hora de sala (salas × horas)" },
  { id: "capacidade", label: "Por capacidade teórica do mês" },
];

const DEFAULTS = { metodo: "nao_ratear", horas_mes: null, capacidade_mes: null };

function localKey(orgId) {
  return `sc_rateio:${orgId}`;
}

function n(v) {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : null;
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

function monthBounds() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { start, end };
}

function readLocal(orgId) {
  try {
    const raw = JSON.parse(localStorage.getItem(localKey(orgId)) || "{}");
    return {
      metodo: RATEIO_METODOS.some((m) => m.id === raw.metodo) ? raw.metodo : DEFAULTS.metodo,
      horas_mes: n(raw.horas_mes),
      capacidade_mes: n(raw.capacidade_mes),
    };
  } catch (_) {
    return { ...DEFAULTS };
  }
}

function writeLocal(orgId, cfg) {
  try {
    localStorage.setItem(localKey(orgId), JSON.stringify(cfg));
  } catch (_) {}
}

export function labelRateio(metodo) {
  return RATEIO_METODOS.find((m) => m.id === metodo)?.label || "não informado";
}

export async function getRateioConfig() {
  const orgId = getActiveOrg();
  if (!orgId) return { ...DEFAULTS };
  const local = readLocal(orgId);
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("rateio_metodo, rateio_horas_mes, rateio_capacidade_mes")
      .eq("id", orgId)
      .maybeSingle();
    if (error || !data) return local;
    return {
      metodo: RATEIO_METODOS.some((m) => m.id === data.rateio_metodo) ? data.rateio_metodo : local.metodo,
      horas_mes: n(data.rateio_horas_mes) ?? local.horas_mes,
      capacidade_mes: n(data.rateio_capacidade_mes) ?? local.capacidade_mes,
    };
  } catch (_) {
    return local;
  }
}

export async function saveRateioConfig(partial) {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  const current = await getRateioConfig();
  const cfg = {
    metodo: RATEIO_METODOS.some((m) => m.id === partial.metodo) ? partial.metodo : current.metodo,
    horas_mes: partial.horas_mes !== undefined ? n(partial.horas_mes) : current.horas_mes,
    capacidade_mes: partial.capacidade_mes !== undefined ? n(partial.capacidade_mes) : current.capacidade_mes,
  };
  writeLocal(orgId, cfg);
  const { error } = await supabase
    .from("organizations")
    .update({
      rateio_metodo: cfg.metodo,
      rateio_horas_mes: cfg.horas_mes,
      rateio_capacidade_mes: cfg.capacidade_mes,
    })
    .eq("id", orgId);
  if (error) {
    const msg = error.message || "";
    if (!(msg.includes("rateio_") || msg.toLowerCase().includes("does not exist"))) {
      throw error;
    }
  }
  return cfg;
}

export async function getCustoFixoMensalAtual() {
  const { start, end } = monthBounds();
  const { data, error } = await withOrg(
    supabase
      .from("financeiro")
      .select("valor, categoria_saida, tipo, data")
      .eq("tipo", "saida")
      .gte("data", start)
      .lte("data", end)
  );
  if (error) return 0;
  return (data || [])
    .filter((r) => r.categoria_saida === "custo_fixo")
    .reduce((s, r) => s + (Number(r.valor) || 0), 0);
}

async function countAgendaMes() {
  const { start, end } = monthBounds();
  const { count, error } = await withOrg(
    supabase.from("agenda").select("id", { count: "exact", head: true }).gte("data", start).lte("data", end)
  );
  if (error) return 0;
  return count || 0;
}

/**
 * Custo estrutural estimado de um procedimento (duração em minutos).
 * @returns {Promise<{ valor: number|null, metodo: string, metodoLabel: string, detalhe: string }>}
 */
export async function explainCustoEstrutural(durationMinutes) {
  const cfg = await getRateioConfig();
  const metodo = cfg.metodo || "nao_ratear";
  const metodoLabel = labelRateio(metodo);
  if (metodo === "nao_ratear") {
    return {
      valor: null,
      metodo,
      metodoLabel,
      detalhe: "A clínica escolheu não ratear fixo no procedimento. O valor aparece no DRE.",
    };
  }

  const fixo = await getCustoFixoMensalAtual();
  if (!(fixo > 0)) {
    return {
      valor: null,
      metodo,
      metodoLabel,
      detalhe: "Não há lançamentos de custo fixo neste mês. Sem isso o rateio fica não informado.",
    };
  }

  const horasProc = Math.max(0.05, (Number(durationMinutes) || 60) / 60);

  if (metodo === "hora") {
    const horas = cfg.horas_mes;
    if (!horas) {
      return { valor: null, metodo, metodoLabel, detalhe: "Informe as horas disponíveis no mês." };
    }
    return {
      valor: round2((fixo / horas) * horasProc),
      metodo,
      metodoLabel,
      detalhe: `R$ ${fixo.toFixed(2)} ÷ ${horas} h × ${horasProc.toFixed(2)} h deste procedimento.`,
    };
  }

  if (metodo === "atendimento") {
    const nAt = await countAgendaMes();
    if (!nAt) {
      return { valor: null, metodo, metodoLabel, detalhe: "Não há agendamentos neste mês para ratear." };
    }
    return {
      valor: round2(fixo / nAt),
      metodo,
      metodoLabel,
      detalhe: `R$ ${fixo.toFixed(2)} ÷ ${nAt} atendimento(s) do mês (mesmo valor por sessão, independente da duração).`,
    };
  }

  if (metodo === "sala") {
    const horas = cfg.horas_mes;
    if (!horas) {
      return { valor: null, metodo, metodoLabel, detalhe: "Informe as horas disponíveis no mês (base da hora de sala)." };
    }
    let nSalas = 0;
    try {
      const salas = await listSalas(false);
      nSalas = (salas || []).length;
    } catch (_) {
      nSalas = 0;
    }
    if (!nSalas) {
      return { valor: null, metodo, metodoLabel, detalhe: "Cadastre ao menos uma sala para ratear por hora de sala." };
    }
    const denom = nSalas * horas;
    return {
      valor: round2((fixo / denom) * horasProc),
      metodo,
      metodoLabel,
      detalhe: `R$ ${fixo.toFixed(2)} ÷ (${nSalas} salas × ${horas} h) × ${horasProc.toFixed(2)} h.`,
    };
  }

  if (metodo === "capacidade") {
    const cap = cfg.capacidade_mes;
    if (!cap) {
      return { valor: null, metodo, metodoLabel, detalhe: "Informe a capacidade teórica (sessões possíveis no mês)." };
    }
    return {
      valor: round2(fixo / cap),
      metodo,
      metodoLabel,
      detalhe: `R$ ${fixo.toFixed(2)} ÷ ${cap} sessões teóricas.`,
    };
  }

  return { valor: null, metodo, metodoLabel, detalhe: "Método não informado." };
}
