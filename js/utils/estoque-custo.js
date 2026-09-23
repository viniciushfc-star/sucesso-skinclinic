/**
 * Custo de material a partir do cadastro de consumo × custo médio.
 * Item sem custo médio não vira zero — o total fica não informado.
 */

export function custoRealFromUsage(usage, custoMedioByName = {}) {
  const map = custoMedioByName || {};
  const itens = (usage || []).map((u) => {
    const ref = String(u.item_ref || u.produto_nome || "").trim();
    const qty = Number(u.quantity_used);
    const key = ref.toLowerCase();
    let custo_unitario = key && map[key] != null && Number.isFinite(Number(map[key])) ? Number(map[key]) : null;
    if (custo_unitario == null && key) {
      const partial = Object.keys(map).find((k) => k.includes(key) || key.includes(k));
      if (partial != null && Number.isFinite(Number(map[partial]))) custo_unitario = Number(map[partial]);
    }
    const q = Number.isFinite(qty) ? qty : 0;
    const subtotal = custo_unitario != null ? custo_unitario * q : null;
    return { item_ref: ref, quantity_used: q, custo_unitario, subtotal };
  });
  if (!itens.length) return { custoReal: null, incompleto: false, itens: [] };
  const incompleto = itens.some((i) => i.custo_unitario == null);
  if (incompleto) return { custoReal: null, incompleto: true, itens };
  const custoReal = Math.round(itens.reduce((s, i) => s + (i.subtotal || 0), 0) * 100) / 100;
  return { custoReal, incompleto: false, itens };
}
