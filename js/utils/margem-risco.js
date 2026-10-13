/**
 * Insumo subiu → procedimentos da receita e margem antes/depois.
 * Não altera preço.
 */

import { computeProcedurePnL } from "./procedimento-pl.js";
import { custoRealFromUsage, qtyFromUsaRende, splitUsageRef } from "./estoque-custo.js";

function round2(x) {
  return Math.round(Number(x) * 100) / 100;
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function usageCasaComProduto(itemRef, produtoNome) {
  const prod = String(produtoNome || "")
    .trim()
    .toLowerCase();
  if (!prod) return false;
  const { nome } = splitUsageRef(itemRef);
  const n = String(nome || "")
    .trim()
    .toLowerCase();
  if (!n || n.startsWith("vaga:") || n.startsWith("aluguel:")) return false;
  if (n === prod) return true;
  if (n.length >= 4 && prod.length >= 4 && (n.includes(prod) || prod.includes(n))) return true;
  return false;
}

export function qtyUsageLinha(u = {}) {
  const parsed = splitUsageRef(u.item_ref);
  const usa = u.usa != null ? u.usa : parsed.usa;
  const rende = u.rende != null ? u.rende : parsed.rende;
  const frac = qtyFromUsaRende(usa, rende);
  if (frac != null) return frac;
  const q = Number(u.quantity_used);
  return Number.isFinite(q) && q > 0 ? q : 0;
}

export function impactoInsumoProcedimento({
  preco,
  comissaoPct = 0,
  taxaPct = 0,
  qty,
  custoAntigo,
  custoNovo,
  materialDepois = null,
  margemAlvoPct = null,
} = {}) {
  const q = Number(qty) || 0;
  const antigo = Number(custoAntigo);
  const novo = Number(custoNovo);
  const deltaLinha =
    q > 0 && Number.isFinite(antigo) && Number.isFinite(novo) ? round2(q * (novo - antigo)) : null;
  let matDepois = materialDepois != null && Number.isFinite(Number(materialDepois)) ? Number(materialDepois) : null;
  if (matDepois == null && q > 0 && Number.isFinite(novo)) matDepois = round2(q * novo);
  const matAntes =
    matDepois != null && deltaLinha != null ? round2(matDepois - deltaLinha) : q > 0 && Number.isFinite(antigo) ? round2(q * antigo) : null;
  const alvo = Number(margemAlvoPct);
  const plA = computeProcedurePnL({
    preco,
    material: matAntes,
    comissaoPct,
    taxaPct,
    margemAlvo: Number.isFinite(alvo) ? alvo : 40,
    margemMin: Number.isFinite(alvo) ? alvo : null,
  });
  const plB = computeProcedurePnL({
    preco,
    material: matDepois,
    comissaoPct,
    taxaPct,
    margemAlvo: Number.isFinite(alvo) ? alvo : 40,
    margemMin: Number.isFinite(alvo) ? alvo : null,
  });
  return {
    deltaMaterial: deltaLinha,
    margemAntes: plA.margemPct,
    margemDepois: plB.margemPct,
    lucroAntes: plA.lucro,
    lucroDepois: plB.lucro,
    incompleto: !(Number(preco) > 0) || matAntes == null || matDepois == null,
  };
}

function fmtPct(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${Number(n).toFixed(1).replace(".", ",")}%`;
}

export function enriquecerAlertasMargem(alertas = [], { procedures = [], usages = [], custoMedioByName = {} } = {}) {
  const procById = {};
  for (const p of procedures || []) procById[p.id] = p;
  const usageByProc = {};
  for (const u of usages || []) {
    if (!u.procedure_id) continue;
    (usageByProc[u.procedure_id] ||= []).push(u);
  }

  return (alertas || []).map((row) => {
    const produto = row.produto_nome || row.metadata?.produto_nome || "";
    const custoAntigo = Number(row.custo_medio_anterior ?? row.metadata?.custo_medio_anterior);
    const custoNovo = Number(row.custo_novo ?? row.metadata?.custo_novo);
    const impactos = [];
    const seen = new Set();
    for (const [pid, rows] of Object.entries(usageByProc)) {
      const linhas = rows.filter((u) => usageCasaComProduto(u.item_ref, produto));
      if (!linhas.length) continue;
      if (seen.has(pid)) continue;
      seen.add(pid);
      const p = procById[pid];
      const qty = linhas.reduce((s, u) => s + qtyUsageLinha(u), 0);
      const rec = custoRealFromUsage(rows, custoMedioByName);
      const materialDepois = rec.incompleto ? null : rec.custoReal;
      const imp = impactoInsumoProcedimento({
        preco: p?.valor_cobrado,
        comissaoPct: p?.comissao_profissional_pct,
        qty,
        custoAntigo,
        custoNovo,
        materialDepois,
        margemAlvoPct: p?.margem_minima_desejada,
      });
      impactos.push({
        procedure_id: pid,
        procedure_name: p?.name || "—",
        qty,
        ...imp,
      });
    }
    impactos.sort((a, b) => Math.abs(b.deltaMaterial || 0) - Math.abs(a.deltaMaterial || 0));
    return {
      ...row,
      produto_nome: produto || row.produto_nome,
      custo_medio_anterior: Number.isFinite(custoAntigo) ? custoAntigo : row.custo_medio_anterior,
      custo_novo: Number.isFinite(custoNovo) ? custoNovo : row.custo_novo,
      procedimentos: impactos.map((i) => ({ procedure_id: i.procedure_id, procedure_name: i.procedure_name })),
      impactos,
    };
  });
}

export function resumoCardMargemRisco(list = []) {
  const uniqueProducts = [...new Set(list.map((x) => x.produto_nome).filter(Boolean))];
  const byProc = new Map();
  for (const row of list) {
    for (const i of row.impactos || []) {
      if (!i.procedure_id || byProc.has(i.procedure_id)) continue;
      byProc.set(i.procedure_id, i);
    }
  }
  const linhas = [...byProc.values()].slice(0, 6).map((i) => {
    if (i.incompleto || i.margemAntes == null || i.margemDepois == null) {
      return `${i.procedure_name}: usa o insumo (margem não informada — falta preço ou custo).`;
    }
    return `${i.procedure_name}: margem ${fmtPct(i.margemAntes)} → ${fmtPct(i.margemDepois)}`;
  });
  return {
    nProdutos: uniqueProducts.length,
    nProcedimentos: byProc.size,
    linhas,
    primeiraLinha: linhas[0] || "",
  };
}

export function htmlCardMargemRisco(list = []) {
  if (!list.length) return "";
  const r = resumoCardMargemRisco(list);
  const lis = r.linhas.map((l) => `<li>${esc(l)}</li>`).join("");
  return `
      <div class="card-margem-risco__inner">
        <span class="card-margem-risco__icon" aria-hidden="true">⚠️</span>
        <div class="card-margem-risco__text">
          <strong>Margem em risco:</strong> ${r.nProdutos} produto(s) subiram ≥15%.
          ${r.nProcedimentos ? ` ${r.nProcedimentos} procedimento(s) usam esses insumos.` : " Nenhum procedimento da receita ligado a esses produtos."}
          ${lis ? `<ul class="card-margem-risco__procs">${lis}</ul>` : ""}
          Revise fornecedor ou o valor cobrado. O sistema não altera o preço.
        </div>
        <a href="#procedimento" class="btn-secondary btn-sm card-margem-risco__link">Revisar procedimentos</a>
      </div>
    `;
}
