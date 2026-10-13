/**
 * Custo de material a partir do cadastro de consumo × custo médio.
 * Item sem custo médio não vira zero — o total fica não informado.
 *
 * 3 pares por procedimento, caixa com 50 pares a R$ 40
 * → fração 3/50 × 40 = R$ 2,40 nesta sessão.
 */

function trimNum(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  if (Math.abs(x - Math.round(x)) < 1e-8) return String(Math.round(x));
  return String(Math.round(x * 1e6) / 1e6);
}

export function qtyFromRendimento(rendimento) {
  return qtyFromUsaRende(1, rendimento);
}

export function qtyFromUsaRende(usa, rende) {
  const a = Number(usa);
  const b = Number(rende);
  if (!Number.isFinite(a) || a <= 0) return null;
  if (!Number.isFinite(b) || b <= 0) return a;
  return Math.round((a / b) * 1e8) / 1e8;
}

export function rendimentoFromQty(qty) {
  const q = Number(qty);
  if (!Number.isFinite(q) || q <= 0) return null;
  const r = 1 / q;
  if (Math.abs(r - Math.round(r)) < 1e-6) return Math.round(r);
  return Math.round(r * 100) / 100;
}

/** Gravado no item_ref sem coluna nova: "Luva@@par@@3/50". */
export const USAGE_UNIDADE_SEP = "@@";

export const UNIDADES_RECEITA = [
  { id: "un", label: "unidade" },
  { id: "g", label: "gramas" },
  { id: "kg", label: "kilos" },
  { id: "mg", label: "miligramas" },
  { id: "ml", label: "mililitros" },
  { id: "l", label: "litros" },
  { id: "cx", label: "caixa" },
  { id: "par", label: "par" },
];

export function normalizarUnidade(u) {
  const s = String(u || "").trim().toLowerCase();
  if (!s || /^(un|und|unid|unidade|unidades)$/.test(s)) return "un";
  if (/^(g|gr|grama|gramas)$/.test(s)) return "g";
  if (/^(kg|kilo|kilos|quilograma|quilogramas)$/.test(s)) return "kg";
  if (/^(mg|miligrama|miligramas)$/.test(s)) return "mg";
  if (/^(ml|mililitro|mililitros)$/.test(s)) return "ml";
  if (/^(l|lt|litro|litros)$/.test(s)) return "l";
  if (/^(cx|caixa|caixas)$/.test(s)) return "cx";
  if (/^(par|pares)$/.test(s)) return "par";
  return s.slice(0, 12);
}

export function labelUnidade(id) {
  const u = UNIDADES_RECEITA.find((x) => x.id === id);
  return u ? u.label : id || "unidade";
}

export function labelUnidadeQtd(id, qtd) {
  const n = Number(qtd);
  const many = Number.isFinite(n) && n !== 1;
  const labels = {
    un: many ? "unidades" : "unidade",
    g: "g",
    kg: "kg",
    mg: "mg",
    ml: "ml",
    l: many ? "litros" : "litro",
    cx: many ? "caixas" : "caixa",
    par: many ? "pares" : "par",
  };
  return labels[id] || labelUnidade(id);
}

export function splitUsageRef(itemRef) {
  const s = String(itemRef || "").trim();
  const parts = s.split(USAGE_UNIDADE_SEP);
  let nome = s;
  let unidade = "un";
  let usa = null;
  let rende = null;
  if (parts.length >= 3) {
    nome = parts[0];
    unidade = normalizarUnidade(parts[1]);
    const m = String(parts[2] || "").match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
    if (m) {
      usa = Number(m[1]);
      rende = Number(m[2]);
    }
  } else if (parts.length === 2) {
    nome = parts[0];
    const m = String(parts[1] || "").match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
    if (m) {
      usa = Number(m[1]);
      rende = Number(m[2]);
    } else {
      unidade = normalizarUnidade(parts[1]);
    }
  }
  return { nome, unidade, usa, rende };
}

export function joinUsageRef(nome, unidade, usa, rende) {
  const n = String(nome || "").trim();
  if (!n) return "";
  const u = normalizarUnidade(unidade);
  const a = Number(usa);
  const b = Number(rende);
  const hasFrac = Number.isFinite(a) && a > 0 && Number.isFinite(b) && b > 0;
  if (hasFrac) return `${n}${USAGE_UNIDADE_SEP}${u}${USAGE_UNIDADE_SEP}${trimNum(a)}/${trimNum(b)}`;
  if (u === "un") return n;
  return n + USAGE_UNIDADE_SEP + u;
}

/** Linha da ficha → o que a baixa pode pré-preencher (editável no dia). */
export function linhaBaixaFromUsage(u = {}) {
  const parsed = splitUsageRef(u.item_ref);
  if (/^aluguel:/i.test(parsed.nome)) {
    return { vaga: false, papel: "", nome: "", unidade: "un", usa: null, rende: null, quantidade: null };
  }
  const vaga = /^vaga:/i.test(parsed.nome);
  const papel = vaga ? parsed.nome.replace(/^vaga:/i, "").trim() : "";
  const usa = u.usa != null ? Number(u.usa) : parsed.usa;
  const rende = u.rende != null ? Number(u.rende) : parsed.rende;
  const frac = qtyFromUsaRende(usa, rende);
  const qtd = Number(u.quantity_used);
  return {
    vaga,
    papel,
    nome: vaga ? "" : parsed.nome,
    unidade: parsed.unidade || "un",
    usa: Number.isFinite(usa) && usa > 0 ? usa : null,
    rende: Number.isFinite(rende) && rende > 0 ? rende : null,
    quantidade: frac != null ? frac : Number.isFinite(qtd) && qtd > 0 ? qtd : null,
  };
}

export function quantidadeConsumoBaixa({ usa, rende, quantidade } = {}) {
  const frac = qtyFromUsaRende(usa, rende);
  if (frac != null) return frac;
  const q = Number(quantidade);
  return Number.isFinite(q) && q > 0 ? q : null;
}

export function custoMedioPorNomeFromResumo(resumo = []) {
  const map = {};
  for (const r of resumo || []) {
    const n = String(r.produto_nome || "").trim().toLowerCase();
    if (n && r.custo_medio != null && Number.isFinite(Number(r.custo_medio))) {
      map[n] = Number(r.custo_medio);
    }
  }
  return map;
}

/** Custo da sessão com as linhas confirmadas na baixa (não o cadastro congelado). */
export function custoRealFromBaixaLinhas(linhas, custoMedioByName = {}) {
  const usage = (linhas || [])
    .map((l) => ({
      item_ref: String(l.produto_nome || l.item_ref || "").trim(),
      quantity_used: l.quantidade,
    }))
    .filter((u) => u.item_ref);
  return custoRealFromUsage(usage, custoMedioByName);
}

export function custoRealFromUsage(usage, custoMedioByName = {}) {
  const map = custoMedioByName || {};
  const itens = (usage || []).map((u) => {
    const raw = String(u.item_ref || u.produto_nome || "").trim();
    const parsed = splitUsageRef(raw);
    const ref = parsed.nome;
    const unidade = u.unidade ? normalizarUnidade(u.unidade) : parsed.unidade;
    const usa = u.usa != null ? Number(u.usa) : parsed.usa;
    const rende = u.rende != null ? Number(u.rende) : parsed.rende;
    const frac = qtyFromUsaRende(usa, rende);
    const qty = Number(u.quantity_used);
    const q = frac != null ? frac : Number.isFinite(qty) ? qty : 0;
    const vaga = /^vaga:/i.test(ref);
    if (/^aluguel:/i.test(ref)) {
      return { item_ref: raw, nome: ref, unidade, usa, rende, quantity_used: q, custo_unitario: null, subtotal: null, vaga: false, aluguel: true };
    }
    if (vaga) {
      return { item_ref: raw, nome: ref, unidade, usa, rende, quantity_used: q, custo_unitario: null, subtotal: null, vaga: true };
    }
    const key = ref.toLowerCase();
    let custo_unitario = key && map[key] != null && Number.isFinite(Number(map[key])) ? Number(map[key]) : null;
    if (custo_unitario == null && key) {
      const partial = Object.keys(map).find((k) => k.includes(key) || key.includes(k));
      if (partial != null && Number.isFinite(Number(map[partial]))) custo_unitario = Number(map[partial]);
    }
    const subtotal = custo_unitario != null ? custo_unitario * q : null;
    return { item_ref: raw, nome: ref, unidade, usa, rende, quantity_used: q, custo_unitario, subtotal, vaga: false };
  });
  if (!itens.length) return { custoReal: null, incompleto: false, itens: [] };
  const concretos = itens.filter((i) => !i.vaga && !i.aluguel);
  if (!concretos.length) return { custoReal: null, incompleto: false, itens };
  const incompleto = concretos.some((i) => i.custo_unitario == null);
  if (incompleto) return { custoReal: null, incompleto: true, itens };
  const custoReal = Math.round(concretos.reduce((s, i) => s + (i.subtotal || 0), 0) * 100) / 100;
  return { custoReal, incompleto: false, itens };
}
