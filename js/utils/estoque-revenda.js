/**
 * Portfólio / revenda: custo + frete, três preços e alerta de validade (< 1 ano).
 * Não inventa lucro nem zera custo ausente.
 */

export const DIAS_VALIDADE_ALERTA = 365;

export function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function diasAteValidade(dataValidade, hoje = new Date()) {
  if (!dataValidade) return null;
  const d = new Date(String(dataValidade).slice(0, 10) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const h = new Date(hoje);
  h.setHours(12, 0, 0, 0);
  return Math.round((d.getTime() - h.getTime()) / 86400000);
}

/** Sinaliza vencido ou menos de um ano para vencer. Sem data → sem alerta. */
export function alertaValidade(dataValidade, hoje = new Date()) {
  const dias = diasAteValidade(dataValidade, hoje);
  if (dias == null) return null;
  if (dias < 0) return { nivel: "vencido", dias, label: "Vencido" };
  if (dias <= DIAS_VALIDADE_ALERTA) {
    return { nivel: "menos_1_ano", dias, label: "Menos de 1 ano para vencer" };
  }
  return null;
}

/** Catalogo: custo e frete típicos por unidade. */
export function custoCatalogoComFrete(custoPago, fretePadrao) {
  const custo = numOrNull(custoPago);
  const frete = numOrNull(fretePadrao);
  if (custo == null && frete == null) return null;
  return (custo || 0) + (frete || 0);
}

/**
 * Entrada: valor unitário + frete total da compra rateado na quantidade.
 * Frete entra como investimento, não some do custo.
 */
export function custoUnitarioComFrete({ valorUnitario, valorTotal, quantidade, valorFrete } = {}) {
  const qty = Number(quantidade) > 0 ? Number(quantidade) : 1;
  let unit = numOrNull(valorUnitario);
  if (unit == null) {
    const total = numOrNull(valorTotal);
    unit = total != null ? total / qty : null;
  }
  const frete = numOrNull(valorFrete);
  if (unit == null && frete == null) return null;
  return (unit || 0) + (frete || 0) / qty;
}

export function lucroUnitario(preco, custoInvestido) {
  const p = numOrNull(preco);
  const c = numOrNull(custoInvestido);
  if (p == null || c == null) return null;
  return Math.round((p - c) * 100) / 100;
}

/**
 * @param {{ catalogo: Array, consumoPorNome?: Record<string, number>, custoMedioPorNome?: Record<string, number|null> }}
 */
export function montarRevenda({ catalogo = [], consumoPorNome = {}, custoMedioPorNome = {} } = {}) {
  const nomes = new Set();
  for (const p of catalogo) {
    const n = String(p.nome || p.produto_nome || "").trim();
    if (n) nomes.add(n);
  }
  for (const n of Object.keys(consumoPorNome || {})) {
    if (n.trim()) nomes.add(n.trim());
  }

  const byNome = {};
  for (const p of catalogo) {
    const n = String(p.nome || p.produto_nome || "").trim();
    if (n) byNome[n.toLowerCase()] = p;
  }

  const rows = [...nomes].map((nome) => {
    const cat = byNome[nome.toLowerCase()] || {};
    const saida = Number(consumoPorNome[nome] || consumoPorNome[nome.toLowerCase()] || 0) || 0;
    const custoCatalogo = custoCatalogoComFrete(cat.custo_pago, cat.frete_padrao);
    const custoMedio = numOrNull(custoMedioPorNome[nome] ?? custoMedioPorNome[nome.toLowerCase()]);
    const custo = custoMedio != null ? custoMedio : custoCatalogo;
    const precoPro = numOrNull(cat.preco_profissional);
    const precoCli = numOrNull(cat.preco_cliente);
    const lucroPro = lucroUnitario(precoPro, custo);
    const lucroCli = lucroUnitario(precoCli, custo);
    return {
      produto_nome: nome,
      saida,
      custo_investido: custo,
      preco_profissional: precoPro,
      preco_cliente: precoCli,
      lucro_profissional_un: lucroPro,
      lucro_cliente_un: lucroCli,
      lucro_estimado_saida: lucroCli != null ? Math.round(lucroCli * saida * 100) / 100 : null,
      alerta_validade: alertaValidade(cat.validade_referencia),
    };
  });

  rows.sort((a, b) => b.saida - a.saida || a.produto_nome.localeCompare(b.produto_nome));
  return rows;
}
