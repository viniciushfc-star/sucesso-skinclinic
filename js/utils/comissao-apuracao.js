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
 * @param {Array<{ userId: string, receita: number, pct: number }>} linhas
 */
export function agruparComissoes(linhas) {
  const byUser = new Map();
  for (const row of linhas || []) {
    const uid = String(row.userId || "").trim();
    if (!uid) continue;
    const receita = Number(row.receita) || 0;
    const pct = Number(row.pct) || 0;
    const valor = comissaoDeReceita(receita, pct);
    const prev = byUser.get(uid) || { userId: uid, receita: 0, comissao: 0, atendimentos: 0 };
    prev.receita = round2(prev.receita + receita);
    prev.comissao = round2(prev.comissao + valor);
    prev.atendimentos += 1;
    byUser.set(uid, prev);
  }
  return [...byUser.values()].sort((a, b) => b.comissao - a.comissao);
}
