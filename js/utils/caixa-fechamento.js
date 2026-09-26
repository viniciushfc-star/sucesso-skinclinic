/**
 * Fechamento de caixa do dia + o que ficou em aberto.
 * Não lança entrada/saída e não paga ninguém.
 */

import { previstoVsRealizado, round2 } from "./comissao-apuracao.js";

export function dataLancamentoIso(row) {
  return String(row?.data || "").slice(0, 10);
}

export function filtrarDoDia(rows, iso) {
  const d = String(iso || "").slice(0, 10);
  return (rows || []).filter((r) => dataLancamentoIso(r) === d);
}

export function chaveForma(forma) {
  const s = String(forma || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
  if (!s) return "nao_informado";
  if (s.includes("pix")) return "pix";
  if (s.includes("dinheiro") || s === "especie" || s === "cash") return "dinheiro";
  if (s.includes("debito")) return "cartao_debito";
  if (s.includes("credito")) return "cartao_credito";
  if (s.includes("transfer")) return "transferencia";
  if (s.includes("boleto")) return "boleto";
  if (s.includes("outro")) return "outro";
  return s.replace(/\s+/g, "_").slice(0, 32) || "outro";
}

export const ROTULO_FORMA = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_debito: "Débito",
  cartao_credito: "Crédito",
  transferencia: "Transferência",
  boleto: "Boleto",
  outro: "Outro",
  nao_informado: "Sem forma",
};

export function valorMovimento(t) {
  if (!t) return 0;
  if (t.tipo === "entrada") {
    return previstoVsRealizado({ valor: t.valor, valorRecebido: t.valor_recebido }).realizado;
  }
  return round2(Number(t.valor) || 0);
}

export function resumirFechamento(rows, isoDate) {
  const dia = filtrarDoDia(rows, isoDate);
  let entradas = 0;
  let saidas = 0;
  const porForma = {};
  for (const t of dia) {
    const v = valorMovimento(t);
    if (t.tipo === "entrada") {
      entradas = round2(entradas + v);
      const k = chaveForma(t.forma_pagamento);
      porForma[k] = round2((porForma[k] || 0) + v);
    } else if (t.tipo === "saida") {
      saidas = round2(saidas + v);
    }
  }
  return {
    data: String(isoDate || "").slice(0, 10),
    qtd: dia.length,
    entradas,
    saidas,
    saldo: round2(entradas - saidas),
    porForma,
    esperadoDinheiro: round2(porForma.dinheiro || 0),
  };
}

export function conferirCaixa({ esperado, conferido } = {}) {
  const e = round2(Number(esperado) || 0);
  if (conferido === "" || conferido == null) {
    return { esperado: e, conferido: null, diferenca: null, ok: null };
  }
  const c = round2(Number(conferido));
  if (!Number.isFinite(Number(conferido))) {
    return { esperado: e, conferido: null, diferenca: null, ok: null };
  }
  const dif = round2(c - e);
  return { esperado: e, conferido: c, diferenca: dif, ok: Math.abs(dif) < 0.01 };
}

export function listarInadimplencia(rows) {
  return (rows || [])
    .filter((t) => t && t.tipo === "entrada")
    .map((t) => {
      const p = previstoVsRealizado({ valor: t.valor, valorRecebido: t.valor_recebido });
      return { row: t, ...p };
    })
    .filter((x) => x.emAberto)
    .sort((a, b) => String(b.row.data || "").localeCompare(String(a.row.data || "")));
}

export function payloadAuditoriaFechamento(resumo, conferencia) {
  return {
    data: resumo?.data || null,
    entradas: resumo?.entradas ?? 0,
    saidas: resumo?.saidas ?? 0,
    saldo: resumo?.saldo ?? 0,
    porForma: resumo?.porForma || {},
    conferidoDinheiro: conferencia?.conferido ?? null,
    diferencaDinheiro: conferencia?.diferenca ?? null,
  };
}
