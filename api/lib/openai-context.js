/**
 * Pré-agregação de contexto para não enviar listas grandes à IA.
 * Regra: nunca enviar listas grandes; sempre pré-agregar no backend.
 */

/**
 * Resumo de lista de transações/vendas: totais, média, top N.
 * @param {Array<{valor?: number, tipo?: string, [key: string]: any}>} items
 * @param {number} [topN]
 * @returns {object}
 */
export function summarizeTransactions(items, topN = 5) {
  if (!items?.length) return { total: 0, count: 0, byType: {}, top: [] };
  const numeric = items.filter((i) => typeof i.valor === "number");
  const total = numeric.reduce((s, i) => s + i.valor, 0);
  const byType = {};
  for (const i of items) {
    const t = i.tipo || "outros";
    byType[t] = (byType[t] || 0) + (i.valor || 0);
  }
  const top = [...items]
    .sort((a, b) => Math.abs(b.valor || 0) - Math.abs(a.valor || 0))
    .slice(0, topN)
    .map((i) => ({ descricao: i.descricao || i.id, valor: i.valor, data: i.data }));
  return {
    total: Math.round(total * 100) / 100,
    count: items.length,
    media: items.length ? Math.round((total / items.length) * 100) / 100 : 0,
    byType,
    top,
  };
}

/**
 * Resumo de lista de clientes: total, últimos cadastros, top N por nome.
 */
export function summarizeClients(items, topN = 5) {
  if (!items?.length) return { total: 0, ultimos: [], top: [] };
  const sorted = [...items].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );
  return {
    total: items.length,
    ultimos: sorted.slice(0, topN).map((c) => ({ nome: c.name, email: c.email, created_at: c.created_at })),
    top: items.slice(0, topN).map((c) => ({ nome: c.name, id: c.id })),
  };
}

/**
 * Resumo de agenda: total no período, por dia (agregado), próximos N.
 */
export function summarizeAgenda(items, nextN = 10) {
  if (!items?.length) return { total: 0, porDia: {}, proximos: [] };
  const porDia = {};
  for (const a of items) {
    const d = (a.data || "").slice(0, 10);
    if (d) porDia[d] = (porDia[d] || 0) + 1;
  }
  const sorted = [...items].sort(
    (a, b) => (a.data || "").localeCompare(b.data || "") || (a.hora || "").localeCompare(b.hora || "")
  );
  return {
    total: items.length,
    porDia,
    proximos: sorted.slice(0, nextN).map((a) => ({
      data: a.data,
      hora: a.hora,
      procedimento: a.procedimento,
      cliente_id: a.cliente_id,
    })),
  };
}

/**
 * Resumo genérico: total, média, variação (se numérico), top N.
 */
export function summarizeGeneric(items, valueKey = "valor", topN = 3) {
  if (!items?.length) return { total: 0, count: 0, top: [] };
  const values = items.map((i) => i[valueKey]).filter((v) => typeof v === "number");
  const total = values.reduce((s, v) => s + v, 0);
  const top = [...items]
    .sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0))
    .slice(0, topN);
  return {
    total: values.length ? Math.round(total * 100) / 100 : 0,
    count: items.length,
    media: values.length ? Math.round((total / values.length) * 100) / 100 : 0,
    top,
  };
}
