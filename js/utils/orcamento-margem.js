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
 * Maior N em que (líquido da maquininha − custo) ainda cobre a margem alvo sobre o valor cobrado.
 * Ex.: margem 40% em R$ 1.000 → precisa sobrar pelo menos R$ 400 depois da taxa e do custo.
 */
export function maxParcelasPreservandoLucro({
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
  if (v <= 0) return { maxParcelas: 1, lucroAlvo, margemAlvoPct: alvoPct };
  let max = 0;
  const nMax = Math.min(12, Math.max(1, Number(maxFixo) || 12));
  for (let n = 1; n <= 12; n++) {
    const liq = Number(typeof getLiquido === "function" ? getLiquido(n) : 0) || 0;
    const lucro = round2(liq - c);
    if (lucro + 0.009 >= lucroAlvo) max = n;
  }
  return {
    maxParcelas: Math.min(max || 1, nMax),
    lucroAlvo,
    margemAlvoPct: alvoPct,
  };
}

export function custoUnitarioServico(procedure, { comissaoPadraoPct = 0 } = {}) {
  const mat = Number(procedure?.custo_material_estimado);
  const comPct =
    procedure?.comissao_profissional_pct != null && procedure.comissao_profissional_pct !== ""
      ? Number(procedure.comissao_profissional_pct)
      : Number(comissaoPadraoPct) || 0;
  const preco = Number(procedure?.valor_cobrado);
  const comissao = Number.isFinite(preco) && preco >= 0 ? (preco * (Number.isFinite(comPct) ? comPct : 0)) / 100 : 0;
  const material = Number.isFinite(mat) && mat >= 0 ? mat : 0;
  if (!Number.isFinite(mat) && !Number.isFinite(comPct)) return null;
  return round2(material + comissao);
}
