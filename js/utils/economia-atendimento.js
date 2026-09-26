/**
 * Fórmula visível da baixa: receita, insumo (real se houver), comissão, taxa.
 * Simular desconto/parcela não altera o preço do catálogo.
 */

import { comissaoDeReceita, round2 } from "./comissao-apuracao.js";

export function escolherCustoMaterial({ real, incompleto, estimado } = {}) {
  const r = Number(real);
  if (incompleto !== true && Number.isFinite(r) && r > 0) {
    return { valor: round2(r), fonte: "estoque" };
  }
  if (estimado == null || estimado === "") return { valor: null, fonte: null };
  const e = Number(estimado);
  if (Number.isFinite(e) && e >= 0) return { valor: round2(e), fonte: "estimado" };
  return { valor: null, fonte: null };
}

export function economiaAtendimento({
  receita,
  custoMaterial = null,
  comissaoPct = 0,
  taxaPct = 0,
  margemAlvoPct = null,
  fonteCusto = null,
} = {}) {
  const rec = round2(Number(receita) || 0);
  const raw = custoMaterial;
  const custoN = Number(raw);
  const custo =
    raw == null || raw === ""
      ? null
      : Number.isFinite(custoN) && custoN >= 0
        ? round2(custoN)
        : null;
  const comissao = comissaoDeReceita(rec, comissaoPct);
  const tx = Number(taxaPct);
  const taxa = rec > 0 && Number.isFinite(tx) && tx > 0 ? round2((rec * tx) / 100) : 0;
  const lucro = custo != null ? round2(rec - custo - comissao - taxa) : null;
  const margemPct = rec > 0 && lucro != null ? round2((lucro / rec) * 100) : null;
  const alvo = Number(margemAlvoPct);
  const abaixoAlvo =
    margemPct != null && Number.isFinite(alvo) && alvo > 0 && margemPct + 0.009 < alvo;
  return {
    receita: rec,
    custo,
    fonteCusto: fonteCusto || null,
    comissao,
    taxa,
    taxaPct: Number.isFinite(tx) ? tx : 0,
    lucro,
    margemPct,
    abaixoAlvo,
    incompleto: custo == null,
  };
}

export function simularDescontoParcela({ receita, descontoPct = 0, taxaPct = 0 } = {}) {
  const rec = round2(Number(receita) || 0);
  const dRaw = Number(descontoPct);
  const desc = Number.isFinite(dRaw) && dRaw > 0 ? round2(Math.min(100, dRaw)) : 0;
  const aposDesconto = round2(rec * (1 - desc / 100));
  const tx = Number(taxaPct) || 0;
  const valorTaxa = aposDesconto > 0 && tx > 0 ? round2((aposDesconto * tx) / 100) : 0;
  const liquido = round2(aposDesconto - valorTaxa);
  return { receita: rec, descontoPct: desc, aposDesconto, taxaPct: tx, valorTaxa, liquido };
}

function brl(n) {
  return `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
}

export function textoEconomiaAtendimento(eco) {
  if (!eco) return "";
  const fonte =
    eco.fonteCusto === "estoque"
      ? "insumo real do estoque"
      : eco.fonteCusto === "estimado"
        ? "custo estimado do procedimento"
        : "custo de material";
  if (eco.incompleto) {
    return `Receita ${brl(eco.receita)}. ${fonte} não informado — margem não calculada. Preço do catálogo não muda.`;
  }
  const alvo = eco.abaixoAlvo ? " Abaixo da margem alvo." : "";
  const m = eco.margemPct != null ? eco.margemPct.toFixed(1).replace(".", ",") : "—";
  const taxaTxt = eco.taxa > 0 ? `, taxa ${brl(eco.taxa)}` : "";
  return `Fórmula: receita ${brl(eco.receita)} − ${fonte} ${brl(eco.custo)} − comissão prevista ${brl(eco.comissao)}${taxaTxt} = lucro ${brl(eco.lucro)} (${m}%).${alvo} Não altera preço.`;
}

export function textoSimulacaoBaixa(sim) {
  if (!sim) return "";
  if (sim.descontoPct <= 0 && sim.taxaPct <= 0) {
    return "Simulação zerada. Informe desconto ou parcelas de crédito para ver o líquido — o catálogo não muda.";
  }
  const desc = sim.descontoPct > 0 ? `${String(sim.descontoPct).replace(".", ",")} % off` : "sem desconto";
  const tx = sim.taxaPct > 0 ? `taxa ${String(sim.taxaPct).replace(".", ",")}%` : "sem taxa de cartão";
  return `Simulação (${desc}, ${tx}): líquido ${brl(sim.liquido)}. Não grava desconto nem muda preço.`;
}
