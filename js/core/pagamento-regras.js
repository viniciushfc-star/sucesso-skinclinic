/**
 * Regras de cobrança no app (parceria com maquininhas).
 * Mercado de referência: 1% por parcela. No app a taxa de uso é menor (ponto a favor).
 * Maquininhas trazem ofertas promocionais para quem usa o SkinClinic.
 * Fallback 3,5% abaixo é só para clínica sem taxa cadastrada — não é a taxa da parceria.
 */

/** Número máximo de parcelas permitidas (ex.: 12). A maquininha pode limitar depois. */
export const PARCELAS_MAXIMAS = 12;

/** Oferta comum de mercado: 1% a cada parcela. */
export const TAXA_MERCADO_POR_PARCELA_PCT = 1;

/** Taxa de uso no app: menor que 1% por parcela. */
export const TAXA_APP_POR_PARCELA_PCT = 0.79;

/** Fallback da maquininha da clínica (Configurações → Taxas), não da parceria. */
export const TAXA_OPERADORA_ESTIMADA_PCT = 3.5;

/** Desconto máximo permitido (% sobre o valor). Opcional; use na tela de cobrança se quiser limitar desconto. */
export const DESCONTO_MAXIMO_PCT = 10;

/**
 * Valor líquido estimado para a clínica (após taxa), só para exibição.
 * @param {number} valorBruto - Valor cobrado do cliente
 * @param {number} [taxaPct] - Taxa em % (default: TAXA_OPERADORA_ESTIMADA_PCT)
 * @returns {number}
 */
export function valorLiquidoEstimado(valorBruto, taxaPct = TAXA_OPERADORA_ESTIMADA_PCT) {
  if (valorBruto == null || valorBruto <= 0) return 0;
  return valorBruto * (1 - taxaPct / 100);
}

/** % total: N parcelas × taxa por parcela. */
export function taxaPorParcelasPct(parcelas, taxaPorParcela = TAXA_APP_POR_PARCELA_PCT) {
  const n = Math.min(PARCELAS_MAXIMAS, Math.max(1, Number(parcelas) || 1));
  return Math.round(n * taxaPorParcela * 100) / 100;
}

export function textoComparativoTaxa(parcelas = 1) {
  const n = Math.min(PARCELAS_MAXIMAS, Math.max(1, Number(parcelas) || 1));
  const mer = taxaPorParcelasPct(n, TAXA_MERCADO_POR_PARCELA_PCT);
  const app = taxaPorParcelasPct(n, TAXA_APP_POR_PARCELA_PCT);
  const merTxt = String(mer).replace(".", ",");
  const appTxt = String(app).replace(".", ",");
  return `No mercado costuma ser ${merTxt}% (${n}×1% por parcela). No app a taxa de uso é ${appTxt}% — menor, para quem cobra pelo SkinClinic.`;
}

export function valorLiquidoApp(valorBruto, parcelas = 1) {
  return valorLiquidoEstimado(valorBruto, taxaPorParcelasPct(parcelas, TAXA_APP_POR_PARCELA_PCT));
}

/**
 * Valor com desconto aplicado (não excede desconto máximo).
 */
export function aplicarDescontoMaximo(valor, descontoPct) {
  const pct = Math.min(Math.max(0, descontoPct), DESCONTO_MAXIMO_PCT);
  const descontoAplicado = valor * (pct / 100);
  return { valorFinal: valor - descontoAplicado, descontoAplicado };
}
