/**
 * Custo, margem e comissão da sessão do pacote.
 * Não altera preço e não lança pagamento de comissão.
 */

import { comissaoDeReceita, round2 } from "./comissao-apuracao.js";
import { valorFinanceiroNaBaixa } from "./ciclo-ouro.js";

export function economiaSessaoPacote({
  valorPagoPacote,
  totalSessoes,
  acrescimo = 0,
  custoMaterialSessao = null,
  comissaoPct = 0,
  margemAlvoPct = null,
} = {}) {
  const receita = valorFinanceiroNaBaixa({
    pacoteId: "sessao",
    valorPagoPacote,
    totalSessoes,
    acrescimo,
  });
  const rawCusto = custoMaterialSessao;
  const custoN = Number(rawCusto);
  const custo =
    rawCusto == null || rawCusto === ""
      ? null
      : Number.isFinite(custoN) && custoN >= 0
        ? round2(custoN)
        : null;
  const comissao = comissaoDeReceita(receita, comissaoPct);
  const lucro = custo != null ? round2(receita - custo - comissao) : null;
  const margemPct = receita > 0 && lucro != null ? round2((lucro / receita) * 100) : null;
  const alvo = Number(margemAlvoPct);
  const abaixoAlvo =
    margemPct != null && Number.isFinite(alvo) && alvo > 0 && margemPct + 0.009 < alvo;
  return {
    receita,
    custo,
    comissao,
    lucro,
    margemPct,
    abaixoAlvo,
    incompleto: custo == null,
  };
}

function brl(n) {
  return `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
}

export function textoEconomiaSessao(eco) {
  if (!eco) return "";
  if (eco.incompleto) {
    return `Sessão do pacote: ${brl(eco.receita)} no financeiro. Custo de material não informado — margem não calculada. Preço do catálogo não muda.`;
  }
  const alvo = eco.abaixoAlvo ? " Abaixo da margem alvo do procedimento." : "";
  const m = eco.margemPct != null ? eco.margemPct.toFixed(1).replace(".", ",") : "—";
  return `Sessão: receita ${brl(eco.receita)}, custo ${brl(eco.custo)}, comissão prevista ${brl(eco.comissao)}, lucro ${brl(eco.lucro)} (${m}%).${alvo} Não altera preço.`;
}
