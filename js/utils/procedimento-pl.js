/**
 * P&L estimado do procedimento.
 * precoCalculado = estrutura de custos, não preço de mercado.
 * Não altera o valor cobrado.
 */

function n(v) {
  if (v == null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

export function computeProcedurePnL({
  preco,
  durationMinutes = 60,
  material = null,
  comissaoPct = 0,
  taxaPct = 0,
  custoEstrutural = null,
  margemAlvo = 40,
  margemMin = null,
} = {}) {
  const p = n(preco);
  const durMin = n(durationMinutes) || 60;
  const horas = durMin / 60;
  const mat = n(material);
  const comPct = n(comissaoPct) ?? 0;
  const txPct = n(taxaPct) ?? 0;
  const est = n(custoEstrutural);
  const alvo = n(margemAlvo) ?? 40;
  const minM = n(margemMin);

  const comissao = p != null ? round2((p * comPct) / 100) : null;
  const taxaPagamento = p != null ? round2((p * txPct) / 100) : null;
  const extras = (comissao || 0) + (taxaPagamento || 0) + (est || 0);
  const custoTotal =
    mat != null
      ? round2(mat + extras)
      : comissao != null || taxaPagamento != null || est != null
        ? round2(extras)
        : null;
  const lucro = p != null && custoTotal != null ? round2(p - custoTotal) : null;
  const margemPct = p > 0 && lucro != null ? round2((lucro / p) * 100) : null;
  const lucroHora = lucro != null && horas > 0 ? round2(lucro / horas) : null;

  const basePreco = (mat || 0) + (est || 0);
  const temBase = (mat != null && mat > 0) || (est != null && est > 0);
  const denomAlvo = 1 - comPct / 100 - txPct / 100 - alvo / 100;
  const precoCalculado = temBase && denomAlvo > 0.05 ? round2(basePreco / denomAlvo) : null;
  const denomMin = 1 - comPct / 100 - txPct / 100 - (minM != null ? minM : 0) / 100;
  const precoMinimo = temBase && minM != null && denomMin > 0.05 ? round2(basePreco / denomMin) : null;
  const denomEq = 1 - comPct / 100 - txPct / 100;
  const precoEquilibrio = temBase && denomEq > 0.05 ? round2(basePreco / denomEq) : null;

  return {
    preco: p,
    material: mat,
    comissaoPct: comPct,
    comissao,
    taxaPct: txPct,
    taxaPagamento,
    custoEstrutural: est,
    custoTotal,
    lucro,
    margemPct,
    lucroHora,
    horas,
    margemAlvo: alvo,
    precoMinimo,
    precoEquilibrio,
    precoCalculado,
  };
}
