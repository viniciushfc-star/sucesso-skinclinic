/**
 * P&L estimado do procedimento.
 * Não altera preço. Números sem dado ficam "não informado".
 * precoCalculado = estrutura de custos, não mercado.
 */

import { getCustoRealProcedimento } from "./estoque-entradas.service.js";
import { getTaxas, getTaxaForParcelas } from "./precificacao-taxas.service.js";
import { explainCustoEstrutural } from "./rateio.service.js";
import { computeProcedurePnL } from "../utils/procedimento-pl.js";

function n(v) {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

/**
 * @param {object} procedure row de procedures
 * @returns {Promise<object>}
 */
export async function explainProcedureEconomics(procedure) {
  const estimado = n(procedure?.custo_material_estimado);
  let real = null;
  try {
    const cr = await getCustoRealProcedimento(procedure.id);
    if (cr && cr.incompleto !== true && cr.custoReal > 0) real = cr.custoReal;
  } catch (_) {
    real = null;
  }
  const material = real != null && real > 0 ? real : estimado;
  const materialFonte = real != null && real > 0 ? "estoque (custo médio × consumo cadastro)" : estimado != null ? "custo material estimado" : null;

  const taxas = await getTaxas();
  const comissaoPct =
    n(procedure?.comissao_profissional_pct) ?? n(taxas.comissao_profissional_padrao_pct) ?? 0;
  const taxaPct = getTaxaForParcelas(taxas, 1, "credito") || 0;
  const margemAlvo = n(procedure?.margem_minima_desejada) ?? n(taxas.margem_alvo_padrao_pct) ?? 40;
  const margemMin = n(procedure?.margem_minima_desejada);

  const durMin = n(procedure?.duration_minutes) || 60;
  let estrutural = { valor: null, metodo: "nao_ratear", metodoLabel: "Não ratear", detalhe: "" };
  try {
    estrutural = await explainCustoEstrutural(durMin);
  } catch (_) {}
  const custoEstrutural = estrutural.valor;

  const pl = computeProcedurePnL({
    preco: procedure?.valor_cobrado,
    durationMinutes: durMin,
    material,
    comissaoPct,
    taxaPct,
    custoEstrutural,
    margemAlvo,
    margemMin,
  });

  const avisoEstrutural =
    custoEstrutural != null
      ? `Custo estrutural pelo método “${estrutural.metodoLabel}”.`
      : estrutural.detalhe || "Custo estrutural não informado.";

  return {
    ...pl,
    materialFonte,
    materialReal: real,
    materialEstimado: estimado,
    rateioMetodo: estrutural.metodo,
    rateioMetodoLabel: estrutural.metodoLabel,
    rateioDetalhe: estrutural.detalhe,
    precoRecomendado: pl.precoCalculado,
    aviso: `Estimativa com o preço atual e taxas à vista crédito. ${avisoEstrutural} O preço calculado usa custo, não mercado. O sistema não altera o preço.`,
  };
}

export function brl(v) {
  if (v == null || Number.isNaN(v)) return "não informado";
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}
