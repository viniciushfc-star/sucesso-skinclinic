/**
 * Regras de cobrança enquanto a API da operadora não está integrada.
 * Use aqui: parcelas máximas, taxa estimada, desconto máximo.
 * Quando a API do banco estiver ativa, essas regras podem vir da resposta da API ou da config por operadora.
 */

/** Número máximo de parcelas permitidas (ex.: 12). A operadora pode limitar depois. */
export const PARCELAS_MAXIMAS = 12;

/** Taxa operadora estimada (% sobre o valor da transação). Só informativo até a API retornar a taxa real. */
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

/**
 * Valor com desconto aplicado (não excede desconto máximo).
 * @param {number} valor - Valor original
 * @param {number} descontoPct - Desconto em %
 * @returns {{ valorFinal: number, descontoAplicado: number }}
 */
export function aplicarDescontoMaximo(valor, descontoPct) {
  const pct = Math.min(Math.max(0, descontoPct), DESCONTO_MAXIMO_PCT);
  const descontoAplicado = valor * (pct / 100);
  return { valorFinal: valor - descontoAplicado, descontoAplicado };
}
