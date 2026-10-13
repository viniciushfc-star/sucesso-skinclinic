/**
 * Margem de orçamento (produto vs serviço) e teto de parcelas.
 * Não altera preço. Humano decide o valor da linha.
 */

import { linhaTotal, round2 } from "./orcamento.js";

export function kindOrcamento(item) {
  const k = String(item?.kind || "").toLowerCase();
  if (k === "produto") return "produto";
  if (k === "servico" || k === "serviço") return "servico";
  if (item?.product_id) return "produto";
  return "servico";
}

export function custoLinhaOrcamento(item) {
  const qty = Number(item?.qty) > 0 ? Number(item.qty) : 0;
  const c = Number(item?.unit_cost);
  if (!Number.isFinite(c) || c < 0 || qty <= 0) return null;
  return round2(c * qty);
}

export function resumoMargemOrcamento(items) {
  let receitaProduto = 0;
  let receitaServico = 0;
  let custoProduto = 0;
  let custoServico = 0;
  let temCustoP = false;
  let temCustoS = false;

  for (const it of items || []) {
    const rec = linhaTotal(it);
    const kind = kindOrcamento(it);
    const c = custoLinhaOrcamento(it);
    if (kind === "produto") {
      receitaProduto += rec;
      if (c != null) {
        custoProduto += c;
        temCustoP = true;
      }
    } else {
      receitaServico += rec;
      if (c != null) {
        custoServico += c;
        temCustoS = true;
      }
    }
  }

  receitaProduto = round2(receitaProduto);
  receitaServico = round2(receitaServico);
  const receita = round2(receitaProduto + receitaServico);
  const custoP = temCustoP ? round2(custoProduto) : null;
  const custoS = temCustoS ? round2(custoServico) : null;
  const custoTotal =
    temCustoP || temCustoS ? round2((custoP || 0) + (custoS || 0)) : null;

  const margem = (rec, custo) => {
    if (rec <= 0 || custo == null) return null;
    return round2(((rec - custo) / rec) * 100);
  };

  return {
    receita,
    receitaProduto,
    receitaServico,
    custoProduto: custoP,
    custoServico: custoS,
    custoTotal,
    lucroProduto: custoP != null ? round2(receitaProduto - custoP) : null,
    lucroServico: custoS != null ? round2(receitaServico - custoS) : null,
    lucroTotal: custoTotal != null ? round2(receita - custoTotal) : null,
    margemProdutoPct: margem(receitaProduto, custoP),
    margemServicoPct: margem(receitaServico, custoS),
    margemTotalPct: margem(receita, custoTotal),
  };
}

/**
 * Sem juros para o cliente = a clínica absorve a taxa da maquininha.
 * Saudável = líquido − (material + comissão + produto) ainda cobre a margem alvo.
 */
export function simularParcelasSaudaveis({
  valor,
  custo = 0,
  margemAlvoPct,
  getLiquido,
  maxFixo = 12,
} = {}) {
  const v = Number(valor) || 0;
  const c = Number(custo) || 0;
  const alvoPct = Math.min(100, Math.max(0, Number(margemAlvoPct) || 0));
  const lucroAlvo = round2(v * (alvoPct / 100));
  const nMax = Math.min(12, Math.max(1, Number(maxFixo) || 12));
  const linhas = [];
  let maxSaudavel = 0;
  let maxSemPrejuizo = 0;
  if (v > 0) {
    for (let n = 1; n <= 12; n++) {
      const liq = Number(typeof getLiquido === "function" ? getLiquido(n) : 0) || 0;
      const lucro = round2(liq - c);
      const cobreAlvo = lucro + 0.009 >= lucroAlvo;
      const semPrejuizo = lucro + 0.009 >= 0;
      if (cobreAlvo) maxSaudavel = n;
      if (semPrejuizo) maxSemPrejuizo = n;
      linhas.push({
        n,
        liquido: round2(liq),
        lucro,
        parcelaCliente: round2(v / n),
        cobreAlvo,
        semPrejuizo,
      });
    }
  }
  return {
    valor: v,
    custo: c,
    lucroAlvo,
    margemAlvoPct: alvoPct,
    maxFixo: nMax,
    maxSaudavel: Math.min(maxSaudavel || (v > 0 ? 1 : 0), nMax),
    maxSemPrejuizo: Math.min(maxSemPrejuizo || (v > 0 ? 1 : 0), nMax),
    linhas,
  };
}

/**
 * Maior N em que (líquido da maquininha − custo) ainda cobre a margem alvo sobre o valor cobrado.
 * Ex.: margem 40% em R$ 1.000 → precisa sobrar pelo menos R$ 400 depois da taxa e do custo.
 */
export function maxParcelasPreservandoLucro(opts = {}) {
  const s = simularParcelasSaudaveis(opts);
  return {
    maxParcelas: s.maxSaudavel || 1,
    lucroAlvo: s.lucroAlvo,
    margemAlvoPct: s.margemAlvoPct,
    maxSemPrejuizo: s.maxSemPrejuizo,
    parcelaCliente: s.linhas.find((l) => l.n === (s.maxSaudavel || 1))?.parcelaCliente ?? null,
    simulacao: s,
  };
}

export function textoParcelasSemJuros(parc, { brl: fmt } = {}) {
  const money =
    typeof fmt === "function"
      ? fmt
      : (n) => `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
  if (!parc || !(Number(parc.simulacao?.valor) > 0)) {
    return "Adicione itens para ver em quantas vezes sem juros ainda é saudável. O preço da proposta não muda.";
  }
  const n = parc.maxParcelas;
  const parcela = parc.parcelaCliente;
  const alvo = parc.margemAlvoPct;
  const teto = parc.simulacao?.maxFixo || 12;
  const vermelho = parc.maxSemPrejuizo;
  const valorParcela = parcela != null ? ` de ${money(parcela)}` : "";
  let extra = "";
  if (n < teto && vermelho > n) {
    extra = ` Até ${vermelho}x ainda não dá prejuízo, mas já fura a margem alvo.`;
  } else if (n < teto) {
    extra = ` Em mais parcelas a taxa da maquininha come a margem.`;
  }
  return `Para o cliente, sem juros (a clínica absorve a taxa): até ${n}x${valorParcela} mantém a margem de ${alvo}% depois de insumos, comissão e maquininha.${extra} Só a equipe vê isso. Você decide o que escrever na proposta.`;
}

export function custoUnitarioServico(procedure, { comissaoPadraoPct = 0, custoMaterialReal = null } = {}) {
  const matEst = Number(procedure?.custo_material_estimado);
  const temReal = custoMaterialReal != null && custoMaterialReal !== "" && Number.isFinite(Number(custoMaterialReal)) && Number(custoMaterialReal) >= 0;
  const matReal = temReal ? Number(custoMaterialReal) : null;
  const mat = temReal ? matReal : Number.isFinite(matEst) && matEst >= 0 ? matEst : 0;
  const temMaterial = temReal || Number.isFinite(matEst);
  const comPct =
    procedure?.comissao_profissional_pct != null && procedure.comissao_profissional_pct !== ""
      ? Number(procedure.comissao_profissional_pct)
      : Number(comissaoPadraoPct) || 0;
  const preco = Number(procedure?.valor_cobrado);
  const comissao = Number.isFinite(preco) && preco >= 0 ? (preco * (Number.isFinite(comPct) ? comPct : 0)) / 100 : 0;
  if (!temMaterial && !Number.isFinite(comPct)) return null;
  return round2(mat + comissao);
}
