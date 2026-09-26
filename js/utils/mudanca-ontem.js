/**
 * Compara o dia de hoje com ontem. Só números já existentes; não inventa.
 */

import { addDaysIso } from "./ciclo-ouro.js";
import { round2 } from "./comissao-apuracao.js";

export function dataOntemIso(hoje) {
  return addDaysIso(hoje, -1);
}

function fmt(n, tipo) {
  const v = round2(Number(n) || 0);
  if (tipo === "brl") return `R$ ${v.toFixed(2).replace(".", ",")}`;
  return String(Math.round(v));
}

export function linhaVsOntem(label, hoje, ontem, tipo = "qtd") {
  const h = round2(Number(hoje) || 0);
  const o = round2(Number(ontem) || 0);
  const d = round2(h - o);
  let direcao = "igual";
  if (d > 0.009) direcao = "mais";
  else if (d < -0.009) direcao = "menos";
  const deltaTxt =
    direcao === "igual"
      ? "igual a ontem"
      : `${fmt(Math.abs(d), tipo)} ${direcao === "mais" ? "a mais" : "a menos"} que ontem`;
  return {
    label,
    hoje: h,
    ontem: o,
    delta: d,
    direcao,
    texto: `${label}: ${fmt(h, tipo)} hoje (${deltaTxt}).`,
  };
}

export function linhasMudancaVsOntem({
  agendaHoje = 0,
  agendaOntem = 0,
  previstoHoje = 0,
  previstoOntem = 0,
  entradasHoje = 0,
  entradasOntem = 0,
} = {}) {
  return [
    linhaVsOntem("Agendamentos", agendaHoje, agendaOntem, "qtd"),
    linhaVsOntem("Previsto", previstoHoje, previstoOntem, "brl"),
    linhaVsOntem("Recebido nas baixas", entradasHoje, entradasOntem, "brl"),
  ];
}
