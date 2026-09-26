/**
 * Lotes, perdas e conferência. Divergência é informação. Não trava atendimento.
 * Ajuste usa estoque_consumo.tipo = ajuste. Não inventa entrada se a contagem sobrou.
 */

export const TIPO_AJUSTE = "ajuste";

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function round4(v) {
  return Math.round(v * 10000) / 10000;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

export function conferirInventario(saldoEstimado, contado) {
  const saldo = n(saldoEstimado);
  const real = n(contado);
  if (saldo == null || real == null || real < 0) return null;
  const divergencia = round4(real - saldo);
  let sentido = "ok";
  if (divergencia < 0) sentido = "faltou";
  else if (divergencia > 0) sentido = "sobrou";
  return { saldo, contado: real, divergencia, sentido };
}

export function payloadAjustePorInventario(produto, conf, extra = {}) {
  const nome = String(produto || "").trim();
  if (!nome || !conf || conf.sentido !== "faltou") return null;
  const qty = Math.abs(Number(conf.divergencia) || 0);
  if (qty <= 0) return null;
  return {
    produto_nome: nome,
    quantidade: qty,
    tipo: TIPO_AJUSTE,
    lote: String(extra.lote || "").trim() || null,
    motivo: String(extra.motivo || "inventario").trim() || "inventario",
  };
}

export function payloadPerda(produto, quantidade, extra = {}) {
  const nome = String(produto || "").trim();
  const qty = n(quantidade);
  if (!nome || qty == null || qty <= 0) return null;
  return {
    produto_nome: nome,
    quantidade: qty,
    tipo: TIPO_AJUSTE,
    lote: String(extra.lote || "").trim() || null,
    motivo: String(extra.motivo || "perda").trim() || "perda",
  };
}

function chaveLote(row) {
  return `${row.produto_nome}|${row.lote}|${row.data_validade || ""}`;
}

/**
 * Saldo restante por lote (FIFO por validade, depois data de entrada).
 * Consumo sem lote come o mais antigo. Com lote, tenta aquele lote primeiro.
 */
export function lotesComSaldo(entradas, consumos) {
  const merged = [];
  for (const e of entradas || []) {
    const produto_nome = String(e?.produto_nome || "").trim();
    const quantidade = n(e?.quantidade) || 0;
    if (!produto_nome || quantidade <= 0) continue;
    const row = {
      produto_nome,
      lote: String(e.lote || "").trim() || "sem_lote",
      data_validade: e.data_validade ? String(e.data_validade).slice(0, 10) : null,
      data_entrada: e.data_entrada ? String(e.data_entrada).slice(0, 10) : null,
      quantidade,
    };
    const hit = merged.find((m) => chaveLote(m) === chaveLote(row));
    if (hit) hit.quantidade += quantidade;
    else merged.push(row);
  }
  merged.sort((a, b) => {
    const va = a.data_validade || "9999-12-31";
    const vb = b.data_validade || "9999-12-31";
    if (va !== vb) return va.localeCompare(vb);
    return String(a.data_entrada || "").localeCompare(String(b.data_entrada || ""));
  });

  for (const c of consumos || []) {
    const produto_nome = String(c?.produto_nome || "").trim();
    let left = n(c?.quantidade) || 0;
    if (!produto_nome || left <= 0) continue;
    const lotePref = String(c.lote || "").trim();
    const pool = lotePref
      ? [
          ...merged.filter((m) => m.produto_nome === produto_nome && m.lote === lotePref),
          ...merged.filter((m) => m.produto_nome === produto_nome && m.lote !== lotePref),
        ]
      : merged.filter((m) => m.produto_nome === produto_nome);
    const seen = new Set();
    for (const m of pool) {
      if (left <= 0) break;
      const id = chaveLote(m);
      if (seen.has(id)) continue;
      seen.add(id);
      const take = Math.min(m.quantidade, left);
      m.quantidade = round4(m.quantidade - take);
      left = round4(left - take);
    }
  }

  return merged.map((m) => ({
    produto_nome: m.produto_nome,
    lote: m.lote,
    data_validade: m.data_validade,
    data_entrada: m.data_entrada,
    saldo: Math.max(0, round4(m.quantidade)),
  }));
}

export function alertaMinimo(saldo, minimo) {
  const s = n(saldo);
  const m = n(minimo);
  if (s == null || m == null || m <= 0) return null;
  if (s < m) return { nivel: "abaixo", label: "Abaixo do mínimo" };
  if (s === m) return { nivel: "no_piso", label: "No mínimo" };
  return null;
}

/**
 * Capital em estoque = saldo × custo médio.
 * Acima do mínimo só se a clínica informou o piso. Sem piso, não inventa excesso.
 */
export function capitalEstoque(linhas) {
  let investido = 0;
  let acimaMinimo = 0;
  let temInvestido = false;
  let temAcima = false;
  for (const r of linhas || []) {
    const saldo = n(r.saldo) || 0;
    const custo = n(r.custo_medio);
    if (!(saldo > 0 && custo != null && custo > 0)) continue;
    investido += saldo * custo;
    temInvestido = true;
    const min = n(r.minimo);
    if (min != null && min >= 0) {
      acimaMinimo += Math.max(0, saldo - min) * custo;
      temAcima = true;
    }
  }
  return {
    investido: temInvestido ? round2(investido) : null,
    acimaMinimo: temAcima && acimaMinimo > 0 ? round2(acimaMinimo) : temAcima ? 0 : null,
  };
}
