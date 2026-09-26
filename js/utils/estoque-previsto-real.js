/**
 * Descartáveis do protocolo (previsto) vs o que a equipe registrou (real).
 * Não trava o atendimento e não altera preço.
 */

function keyNome(n) {
  return String(n || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function qty(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * O que baixa no estoque: o registrado; se o nome do protocolo não foi listado, assume o previsto.
 */
export function itensParaConsumoEstoque(previsto = [], real = []) {
  const out = [];
  const have = new Set();
  for (const r of real || []) {
    const nome = String(r.produto_nome || "").trim();
    if (!nome) continue;
    out.push({ produto_nome: nome, quantidade: qty(r.quantidade) || 1 });
    have.add(keyNome(nome));
  }
  for (const p of previsto || []) {
    const nome = String(p.produto_nome || "").trim();
    if (!nome || have.has(keyNome(nome))) continue;
    out.push({ produto_nome: nome, quantidade: qty(p.quantidade) || 1 });
    have.add(keyNome(nome));
  }
  return out;
}

export function compararEstoquePrevistoReal({ previsto = [], real = [] } = {}) {
  const map = new Map();
  for (const p of previsto || []) {
    const nome = String(p.produto_nome || "").trim();
    if (!nome) continue;
    const k = keyNome(nome);
    const prev = map.get(k) || { nome, previsto: 0, real: 0 };
    prev.previsto += qty(p.quantidade) || 1;
    map.set(k, prev);
  }
  const extras = [];
  for (const r of real || []) {
    const nome = String(r.produto_nome || "").trim();
    if (!nome) continue;
    const k = keyNome(nome);
    const q = qty(r.quantidade) || 1;
    if (map.has(k)) {
      map.get(k).real += q;
    } else {
      extras.push({ nome, previsto: 0, real: q, tipo: "extra" });
    }
  }
  const linhas = [...map.values()].map((row) => {
    let tipo = "ok";
    if (row.real === 0) tipo = "faltou";
    else if (Math.abs(row.real - row.previsto) > 0.009) tipo = "divergente";
    return { ...row, tipo };
  });
  const all = [...linhas, ...extras];
  return {
    temDivergencia: all.some((l) => l.tipo !== "ok"),
    linhas: all,
  };
}
