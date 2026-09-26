/**
 * Comissão sugerida sobre baixa já lançada. Não paga ninguém e não altera preço.
 */

export function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function comissaoDeReceita(receita, pct) {
  const r = Number(receita);
  const p = Number(pct);
  if (!Number.isFinite(r) || r <= 0 || !Number.isFinite(p) || p <= 0) return 0;
  return round2((r * p) / 100);
}

/**
 * @param {Array<{ userId: string, receita: number, pct: number, receitaPrevista?: number }>} linhas
 */
export function agruparComissoes(linhas) {
  const byUser = new Map();
  for (const row of linhas || []) {
    const uid = String(row.userId || "").trim();
    if (!uid) continue;
    const receita = Number(row.receita) || 0;
    const pct = Number(row.pct) || 0;
    const valor = comissaoDeReceita(receita, pct);
    const previstaNum = row.receitaPrevista != null && row.receitaPrevista !== ""
      ? Number(row.receitaPrevista)
      : receita;
    const prev = byUser.get(uid) || {
      userId: uid,
      receita: 0,
      receitaPrevista: 0,
      comissao: 0,
      comissaoPrevista: 0,
      aberto: 0,
      atendimentos: 0,
    };
    prev.receita = round2(prev.receita + receita);
    prev.receitaPrevista = round2(prev.receitaPrevista + (Number.isFinite(previstaNum) ? previstaNum : 0));
    prev.comissao = round2(prev.comissao + valor);
    prev.comissaoPrevista = round2(prev.comissaoPrevista + comissaoDeReceita(Number.isFinite(previstaNum) ? previstaNum : 0, pct));
    prev.atendimentos += 1;
    prev.aberto = round2(Math.max(0, prev.receitaPrevista - prev.receita));
    byUser.set(uid, prev);
  }
  return [...byUser.values()].sort((a, b) => b.comissao - a.comissao);
}

/**
 * Cobrado vs recebido na mesma baixa. Não cria lançamento extra.
 */
export function previstoVsRealizado({ valor, valorRecebido, pct = 0 } = {}) {
  const previsto = Number(valor);
  const p = Number.isFinite(previsto) && previsto > 0 ? round2(previsto) : 0;
  const hasRec = valorRecebido != null && valorRecebido !== "" && Number.isFinite(Number(valorRecebido));
  const realizado = hasRec ? round2(Number(valorRecebido)) : p;
  const aberto = round2(Math.max(0, p - realizado));
  return {
    previsto: p,
    realizado,
    aberto,
    emAberto: aberto > 0.009,
    comissaoPrevista: comissaoDeReceita(p, pct),
    comissaoRealizada: comissaoDeReceita(realizado, pct),
  };
}
