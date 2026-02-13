/**
 * Precificação e taxas — usa as taxas reais do banco da clínica para mostrar
 * quanto ela realmente recebe por parcela e até quantas parcelas / quanto de desconto à vista vale a pena.
 */

import { getOrganizationProfile, updateOrganizationProfile } from "./organization-profile.service.js";
import { TAXA_OPERADORA_ESTIMADA_PCT } from "../core/pagamento-regras.js";

/** Retorna as taxas da organização (com fallback para valor padrão se não configurado). */
export async function getTaxas() {
  const profile = await getOrganizationProfile();
  const out = {
    taxa_transacao_pct: profile.taxa_transacao_pct != null ? Number(profile.taxa_transacao_pct) : null,
    taxa_avista_pct: profile.taxa_avista_pct != null ? Number(profile.taxa_avista_pct) : null,
    taxa_avista_debito_pct: profile.taxa_avista_debito_pct != null ? Number(profile.taxa_avista_debito_pct) : null,
    taxa_avista_credito_pct: profile.taxa_avista_credito_pct != null ? Number(profile.taxa_avista_credito_pct) : null,
    taxa_parcelado_2_6_pct: profile.taxa_parcelado_2_6_pct != null ? Number(profile.taxa_parcelado_2_6_pct) : null,
    taxa_parcelado_7_12_pct: profile.taxa_parcelado_7_12_pct != null ? Number(profile.taxa_parcelado_7_12_pct) : null,
  };
  for (let i = 2; i <= 12; i++) {
    const key = `taxa_parcelado_${i}_pct`;
    out[key] = profile[key] != null ? Number(profile[key]) : null;
  }
  return out;
}

/**
 * Taxa em % para um número de parcelas e tipo (à vista: 'debito' ou 'credito'; parcelado: cada N tem sua taxa).
 * Inclui taxa de transação na soma.
 */
export function getTaxaForParcelas(taxas, parcelas, tipo = "credito") {
  const n = Math.max(1, Math.min(12, parseInt(parcelas, 10) || 1));
  const transacao = (taxas.taxa_transacao_pct != null ? Number(taxas.taxa_transacao_pct) : 0) || 0;
  let forma = 0;
  if (n === 1) {
    if (tipo === "debito" && taxas.taxa_avista_debito_pct != null) {
      forma = Number(taxas.taxa_avista_debito_pct);
    } else if (tipo === "credito" && taxas.taxa_avista_credito_pct != null) {
      forma = Number(taxas.taxa_avista_credito_pct);
    } else {
      forma = taxas.taxa_avista_pct != null ? Number(taxas.taxa_avista_pct) : TAXA_OPERADORA_ESTIMADA_PCT;
    }
  } else {
    const key = `taxa_parcelado_${n}_pct`;
    if (taxas[key] != null) {
      forma = Number(taxas[key]);
    } else if (n <= 6 && taxas.taxa_parcelado_2_6_pct != null) {
      forma = taxas.taxa_parcelado_2_6_pct;
    } else if (n >= 7 && taxas.taxa_parcelado_7_12_pct != null) {
      forma = taxas.taxa_parcelado_7_12_pct;
    } else {
      forma = n <= 6 ? TAXA_OPERADORA_ESTIMADA_PCT + 0.5 : TAXA_OPERADORA_ESTIMADA_PCT + 1;
    }
  }
  return transacao + forma;
}

/** Valor líquido que a clínica recebe após a taxa. */
export function calcularLiquido(valorBruto, taxaPct) {
  if (valorBruto == null || valorBruto <= 0) return 0;
  const pct = Number(taxaPct) || 0;
  return valorBruto * (1 - pct / 100);
}

/** Simulação: para um valor, retorna array com parcelas 1..12, taxa aplicada e líquido. */
export function getSimulacaoParcelas(valor, taxas) {
  const v = Number(valor) || 0;
  if (v <= 0) return [];
  const rows = [];
  for (let n = 1; n <= 12; n++) {
    const taxaPct = getTaxaForParcelas(taxas, n);
    const liquido = calcularLiquido(v, taxaPct);
    rows.push({ parcelas: n, taxaPct, liquido, label: n === 1 ? "À vista" : `${n}x` });
  }
  return rows;
}

/**
 * Desconto máximo (% à vista) para que o líquido à vista seja >= líquido em N parcelas.
 * Ex.: "Se você der até X% de desconto à vista, ainda recebe mais que em 12x."
 */
export function getDescontoMaximoParaSuperarParcelado(valor, taxas, parcelasRef = 12) {
  const v = Number(valor) || 0;
  if (v <= 0) return 0;
  const liquidoRef = calcularLiquido(v, getTaxaForParcelas(taxas, parcelasRef));
  return descontoMaximoParaManterLiquido(v, getTaxaForParcelas(taxas, 1), liquidoRef);
}

/**
 * Dado valor, taxa à vista (%) e líquido de referência: desconto máximo (% à vista)
 * para que o líquido à vista seja >= liquidoRef.
 */
export function descontoMaximoParaManterLiquido(valor, taxaAvistaPct, liquidoRef) {
  const v = Number(valor) || 0;
  if (v <= 0) return 0;
  const taxa = Number(taxaAvistaPct) || 0;
  const ref = Number(liquidoRef) || 0;
  const divisor = v * (1 - taxa / 100);
  if (divisor <= 0) return 0;
  const desc = (1 - ref / divisor) * 100;
  return Math.max(0, Math.min(100, Math.round(desc * 10) / 10));
}

/** Salva as taxas no perfil da organização. */
export async function saveTaxas(payload) {
  const toNum = (v) => (v === "" || v == null ? null : Number(v));
  const update = {
    taxa_transacao_pct: toNum(payload.taxa_transacao_pct),
    taxa_avista_pct: toNum(payload.taxa_avista_pct),
    taxa_avista_debito_pct: toNum(payload.taxa_avista_debito_pct),
    taxa_avista_credito_pct: toNum(payload.taxa_avista_credito_pct),
    taxa_parcelado_2_6_pct: toNum(payload.taxa_parcelado_2_6_pct),
    taxa_parcelado_7_12_pct: toNum(payload.taxa_parcelado_7_12_pct),
  };
  for (let i = 2; i <= 12; i++) {
    update[`taxa_parcelado_${i}_pct`] = toNum(payload[`taxa_parcelado_${i}_pct`]);
  }
  await updateOrganizationProfile(update);
}

/** Alias para a view: retorna as taxas da organização. */
export const getTaxasOrganizacao = getTaxas;

/** Alias para a view: salva e retorna as taxas atualizadas. */
export async function updateTaxasOrganizacao(payload) {
  await saveTaxas(payload);
  return getTaxas();
}

/** Alias para a view. */
export const getTaxaParaParcelas = getTaxaForParcelas;

/* ========== Precificação com margem (cruzamento com Procedimentos) ========== */

/**
 * Valor bruto mínimo a cobrar para que, após a taxa, o líquido dê a margem desejada sobre o custo.
 * Margem = (líquido - custo) / líquido → líquido = custo / (1 - margemPct/100).
 * valorBruto = líquido / (1 - taxaPct/100).
 * @param {number} custo - Custo (ex.: material)
 * @param {number} margemPct - Margem desejada sobre o que você recebe (0–100)
 * @param {number} taxaPct - Taxa da operadora em %
 * @returns {number} Valor mínimo a cobrar (bruto)
 */
export function valorBrutoMinimoParaMargem(custo, margemPct, taxaPct) {
  const c = Number(custo) || 0;
  if (c <= 0) return 0;
  const margem = Number(margemPct) || 0;
  if (margem >= 100) return Infinity;
  const taxa = Number(taxaPct) || 0;
  if (taxa >= 100) return Infinity;
  const liquidoDesejado = c / (1 - margem / 100);
  return liquidoDesejado / (1 - taxa / 100);
}

/**
 * Margem real (% sobre o que você recebe) dado líquido e custo.
 * (líquido - custo) / líquido * 100. Retorna null se líquido <= 0.
 */
export function margemReal(liquido, custo) {
  const l = Number(liquido) || 0;
  const c = Number(custo) || 0;
  if (l <= 0) return null;
  return ((l - c) / l) * 100;
}
