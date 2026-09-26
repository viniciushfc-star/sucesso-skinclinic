/**
 * Rateio de custo fixo no P&L do procedimento.
 * Padrão: não ratear. Cancelados não entram no denominador. Não inventa; não altera preço.
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { listSalas } from "./salas.service.js";
import {
  RATEIO_METODOS,
  labelRateio,
  calcularRateio,
  ocupacaoRateio,
  simularMetodosRateio,
} from "../utils/rateio.js";

export { RATEIO_METODOS, labelRateio, calcularRateio };

const DEFAULTS = { metodo: "nao_ratear", horas_mes: null, capacidade_mes: null };

function localKey(orgId) {
  return `sc_rateio:${orgId}`;
}

function n(v) {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? x : null;
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

export async function getCustoFixoPeriodo(start, end) {
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

export async function getCustoFixoMensalAtual() {
  const { start, end } = monthBounds();
  return getCustoFixoPeriodo(start, end);
}

export async function agendaResumoPeriodo(start, end) {
  let res = await withOrg(
    supabase
      .from("agenda")
      .select("id, duration_minutes, cancelled_at")
      .gte("data", start)
      .lte("data", end)
      .limit(4000)
  );
  if (res.error && /cancelled_at|schema cache|column/i.test(String(res.error.message || ""))) {
    res = await withOrg(
      supabase.from("agenda").select("id, duration_minutes").gte("data", start).lte("data", end).limit(4000)
    );
  }
  if (res.error) return { nAtendimentos: 0, minutos: 0 };
  const rows = (res.data || []).filter((r) => !r.cancelled_at);
  const minutos = rows.reduce((s, r) => s + (Number(r.duration_minutes) || 60), 0);
  return { nAtendimentos: rows.length, minutos };
}

async function nSalasAtivas() {
  try {
    const salas = await listSalas(false);
    return (salas || []).length;
  } catch (_) {
    return 0;
  }
}

function inputsRateio(cfg, fixo, agenda, nSalas) {
  return {
    fixoMes: fixo,
    horasMes: cfg.horas_mes,
    nAtendimentos: agenda.nAtendimentos,
    nSalas,
    capacidadeMes: cfg.capacidade_mes,
  };
}

export async function explainCustoEstrutural(durationMinutes) {
  const cfg = await getRateioConfig();
  const { start, end } = monthBounds();
  const [fixo, agenda, nSalas] = await Promise.all([
    getCustoFixoPeriodo(start, end),
    agendaResumoPeriodo(start, end),
    nSalasAtivas(),
  ]);
  return calcularRateio({
    metodo: cfg.metodo,
    durationMinutes,
    ...inputsRateio(cfg, fixo, agenda, nSalas),
  });
}

/**
 * Painel do DRE: fórmula escolhida + ocupação + simulação dos métodos.
 * durationMinutes = 60 para comparar sessões-padrão. Não muda preço.
 */
export async function getPainelRateio(start, end) {
  const cfg = await getRateioConfig();
  const [fixo, agenda, nSalas] = await Promise.all([
    getCustoFixoPeriodo(start, end),
    agendaResumoPeriodo(start, end),
    nSalasAtivas(),
  ]);
  const base = { durationMinutes: 60, ...inputsRateio(cfg, fixo, agenda, nSalas) };
  const escolhido = calcularRateio({ ...base, metodo: cfg.metodo });
  const ocupacao = ocupacaoRateio({
    metodo: cfg.metodo,
    minutosAgenda: agenda.minutos,
    nAtendimentos: agenda.nAtendimentos,
    horasMes: cfg.horas_mes,
    nSalas,
    capacidadeMes: cfg.capacidade_mes,
  });
  return {
    cfg,
    fixo,
    agenda,
    nSalas,
    escolhido,
    ocupacao,
    simulacoes: simularMetodosRateio(base),
  };
}
