/**
 * P&L estimado do procedimento.
 * Não altera preço. Números sem dado ficam "não informado".
 */

import { getCustoRealProcedimento } from "./estoque-entradas.service.js";
import { getTaxas, getTaxaForParcelas } from "./precificacao-taxas.service.js";
import { explainCustoEstrutural } from "./rateio.service.js";

function n(v) {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

/**
 * @param {object} procedure row de procedures
 * @returns {Promise<object>}
 */
export async function explainProcedureEconomics(procedure) {
  const preco = n(procedure?.valor_cobrado);
  const durMin = n(procedure?.duration_minutes) || 60;
  const horas = durMin / 60;
  const estimado = n(procedure?.custo_material_estimado);
  let real = null;
  try {
    const cr = await getCustoRealProcedimento(procedure.id);
    if (cr?.custoReal > 0) real = cr.custoReal;
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

  const comissao = preco != null ? round2((preco * comissaoPct) / 100) : null;
  const taxaPagamento = preco != null ? round2((preco * taxaPct) / 100) : null;

  let estrutural = { valor: null, metodo: "nao_ratear", metodoLabel: "Não ratear", detalhe: "" };
  try {
    estrutural = await explainCustoEstrutural(durMin);
  } catch (_) {}
  const custoEstrutural = estrutural.valor;

  const extras = (comissao || 0) + (taxaPagamento || 0) + (custoEstrutural || 0);
  const custoTotal =
    material != null
      ? round2(material + extras)
      : comissao != null || taxaPagamento != null || custoEstrutural != null
        ? round2(extras)
        : null;
  const lucro = preco != null && custoTotal != null ? round2(preco - custoTotal) : null;
  const margemPct = preco > 0 && lucro != null ? round2((lucro / preco) * 100) : null;
  const lucroHora = lucro != null && horas > 0 ? round2(lucro / horas) : null;

  const basePreco = (material || 0) + (custoEstrutural || 0);
  const temBase = (material != null && material > 0) || (custoEstrutural != null && custoEstrutural > 0);
  const denomAlvo = 1 - comissaoPct / 100 - taxaPct / 100 - margemAlvo / 100;
  const precoRecomendado = temBase && denomAlvo > 0.05 ? round2(basePreco / denomAlvo) : null;
  const denomMin = 1 - comissaoPct / 100 - taxaPct / 100 - (margemMin != null ? margemMin : 0) / 100;
  const precoMinimo =
    temBase && margemMin != null && denomMin > 0.05 ? round2(basePreco / denomMin) : null;
  const denomEq = 1 - comissaoPct / 100 - taxaPct / 100;
  const precoEquilibrio = temBase && denomEq > 0.05 ? round2(basePreco / denomEq) : null;

  const avisoEstrutural =
    custoEstrutural != null
      ? `Custo estrutural pelo método “${estrutural.metodoLabel}”.`
      : estrutural.detalhe || "Custo estrutural não informado.";

  return {
    preco,
    material,
    materialFonte,
    materialReal: real,
    materialEstimado: estimado,
    comissaoPct,
    comissao,
    taxaPct,
    taxaPagamento,
    custoEstrutural,
    rateioMetodo: estrutural.metodo,
    rateioMetodoLabel: estrutural.metodoLabel,
    rateioDetalhe: estrutural.detalhe,
    custoTotal,
    lucro,
    margemPct,
    lucroHora,
    horas,
    margemAlvo,
    precoMinimo,
    precoEquilibrio,
    precoRecomendado,
    aviso: `Estimativa com o preço atual e taxas à vista crédito. ${avisoEstrutural} O sistema não altera o preço.`,
  };
}

export function brl(v) {
  if (v == null || Number.isNaN(v)) return "não informado";
  return `R$ ${Number(v).toFixed(2).replace(".", ",")}`;
}
