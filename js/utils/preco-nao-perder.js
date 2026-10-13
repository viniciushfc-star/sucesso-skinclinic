/**
 * Custo + taxa + faixa citada. Não grava preço. Não inventa concorrente.
 */

import { compararPreco, copyComparacao, isFonteCompleta } from "./market-radar.js";

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Payload de mercado que a IA pode ver. Sem fonte completa → null (ela calcula só custo).
 */
export function mercadoParaIa(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const faixa = {
    procedimento: String(raw.procedimento || "").trim(),
    regiao: String(raw.regiao || "").trim(),
    fonte: String(raw.fonte || "").trim(),
    data_ref: String(raw.data_ref || "").slice(0, 10),
    metodologia: String(raw.metodologia || "").trim(),
    confianca: String(raw.confianca || "").toLowerCase(),
    amostra: Number(raw.amostra),
    preco_min: Number(raw.preco_min ?? raw.faixa_min),
    preco_max: Number(raw.preco_max ?? raw.faixa_max),
  };
  if (isFonteCompleta(faixa)) {
    return {
      tipo: "radar",
      preco_min: faixa.preco_min,
      preco_max: faixa.preco_max,
      fonte: faixa.fonte.slice(0, 200),
      regiao: faixa.regiao.slice(0, 80),
      data_ref: faixa.data_ref,
      metodologia: faixa.metodologia.slice(0, 200),
      confianca: faixa.confianca,
      amostra: faixa.amostra,
    };
  }
  const ticket = Number(raw.ticket || raw.ticketMedio);
  const concorrencia = String(raw.concorrencia || "").trim();
  if (!(Number.isFinite(ticket) && ticket > 0) || concorrencia.length < 3) return null;
  return { ticket, concorrencia: concorrencia.slice(0, 200) };
}

/**
 * @returns {{ tom: string, titulo: string, alerta: string, cmp: object, margemAposTaxa: number|null, minAvistaAlvo: number|null, temRadar: boolean }}
 */
export function leituraNaoPerder({
  preco,
  custo,
  margemAlvo,
  liquidoAvista,
  taxaAvistaPct,
  minAvistaAlvo,
  radar,
} = {}) {
  const r = radar && isFonteCompleta(radar) ? radar : null;
  const cmp = r
    ? compararPreco(preco, r.preco_min, r.preco_max)
    : { posicao: "sem_faixa", delta: null };
  let margemAposTaxa = null;
  const liq = Number(liquidoAvista);
  const c = Number(custo);
  if (Number.isFinite(liq) && liq > 0 && Number.isFinite(c) && c > 0) {
    margemAposTaxa = round2(((liq - c) / liq) * 100);
  }
  const alvo = Number(margemAlvo);
  const abaixoMargem = Number.isFinite(alvo) && margemAposTaxa != null && margemAposTaxa < alvo;
  const abaixoMercado = cmp.posicao === "abaixo";
  const acimaMercado = cmp.posicao === "acima";
  const naFaixa = cmp.posicao === "na_faixa";

  let tom = "info";
  let titulo = "Custo, taxa e mercado";
  let alerta = "";

  if (!r) {
    alerta =
      "Sem faixa de mercado com fonte. O radar não compara. Cadastre referência (fonte, região, data, método, amostra) em Radar de mercado. O sistema não inventa concorrente e não altera o preço.";
  } else {
    alerta = copyComparacao({
      posicao: cmp.posicao,
      fonte: r.fonte,
      regiao: r.regiao,
      dataRef: String(r.data_ref).slice(0, 10),
    });
    if (abaixoMercado && abaixoMargem) {
      tom = "warning";
      titulo = "Risco de deixar dinheiro na mesa";
      alerta +=
        " Depois da maquininha a margem também fica abaixo da mínima desejada. O sistema não altera o preço.";
    } else if (abaixoMercado) {
      tom = "warning";
      titulo = "Abaixo da referência observada";
      alerta += " Custo, posicionamento ou mix podem justificar. O sistema não altera o preço.";
    } else if (abaixoMargem) {
      tom = "warning";
      titulo = "Margem após taxa abaixo do alvo";
      const taxa = Number.isFinite(Number(taxaAvistaPct)) ? String(round2(taxaAvistaPct)).replace(".", ",") : "—";
      const m = String(margemAposTaxa).replace(".", ",");
      alerta =
        `À vista, depois da taxa (~${taxa}%), a margem fica em ${m}%. O alvo é ${String(alvo).replace(".", ",")}%. O sistema não altera o preço.`;
    } else if (naFaixa && !abaixoMargem) {
      tom = "success";
      titulo = "Na faixa citada, margem após taxa ok";
    } else if (acimaMercado) {
      tom = "info";
      titulo = "Acima da referência observada";
      alerta += " Posicionamento ou mix podem justificar. O sistema não altera o preço.";
    }
  }

  return {
    tom,
    titulo,
    alerta,
    cmp,
    margemAposTaxa,
    minAvistaAlvo: Number.isFinite(Number(minAvistaAlvo)) ? Number(minAvistaAlvo) : null,
    temRadar: !!r,
    abaixoMargem,
    abaixoMercado,
    acimaMercado,
  };
}
