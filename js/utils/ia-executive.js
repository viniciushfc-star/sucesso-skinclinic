/**
 * IA Executive: explica a variação do dia com elos já ligados.
 * Só usa agenda, previsto, baixa e consumo. Não inventa. Não muda preço.
 */

import { round2 } from "./comissao-apuracao.js";
import { linhasMudancaVsOntem } from "./mudanca-ontem.js";

export const MSG_SEM_VARIACAO =
  "Nada a explicar: agendamentos, previsto e recebido ficaram iguais a ontem.";

function brl(n) {
  const v = round2(Number(n) || 0);
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

export function somaConsumoNoDia(rows, dia) {
  if (!Array.isArray(rows)) return null;
  const d = String(dia || "").slice(0, 10);
  if (!d) return null;
  let n = 0;
  for (const r of rows) {
    if (String(r.created_at || "").slice(0, 10) !== d) continue;
    const q = Number(r.quantidade);
    if (Number.isFinite(q)) n += q;
  }
  return round2(n);
}

function linhaDe(linhas, label) {
  return (linhas || []).find((l) => l.label === label) || null;
}

function card({ titulo, causa, impacto, fonte, direcao, metrica }) {
  return {
    titulo: String(titulo || "").trim(),
    causa: String(causa || "").trim(),
    impacto: String(impacto || "").trim(),
    fonte: String(fonte || "").trim(),
    direcao: direcao || "igual",
    metrica: metrica || "",
  };
}

function explicarRecebido(linhas, extra) {
  const rec = linhaDe(linhas, "Recebido nas baixas");
  const age = linhaDe(linhas, "Agendamentos");
  const prev = linhaDe(linhas, "Previsto");
  if (!rec || rec.direcao === "igual") return null;
  const baixasHoje = Number(extra.baixasHoje);
  const baixasOntem = Number(extra.baixasOntem);
  const temBaixas = Number.isFinite(baixasHoje) && Number.isFinite(baixasOntem);
  const baixasMenos = temBaixas && baixasHoje + 0.009 < baixasOntem;
  const baixasMais = temBaixas && baixasHoje > baixasOntem + 0.009;

  if (rec.direcao === "menos") {
    if (age?.direcao === "menos") {
      return card({
        titulo: `Recebido ${brl(Math.abs(rec.delta))} a menos que ontem`,
        causa: `Houve menos horários na agenda (${age.hoje} hoje, ${age.ontem} ontem).`,
        impacto: "Menor volume no dia. O sistema não dispara cobrança nem WhatsApp.",
        fonte: "agenda do dia e baixas do financeiro",
        direcao: "menos",
        metrica: "recebido",
      });
    }
    if (baixasMenos) {
      return card({
        titulo: `Recebido ${brl(Math.abs(rec.delta))} a menos que ontem`,
        causa: `Houve menos baixas (${baixasHoje} hoje, ${baixasOntem} ontem) mesmo com a agenda em ${age?.hoje ?? "—"} horários.`,
        impacto: "O previsto do dia ainda não virou recebido.",
        fonte: "baixas do financeiro ligadas à agenda",
        direcao: "menos",
        metrica: "recebido",
      });
    }
    if (prev?.direcao === "menos") {
      return card({
        titulo: `Recebido ${brl(Math.abs(rec.delta))} a menos que ontem`,
        causa: `O previsto da agenda caiu (${brl(prev.hoje)} hoje, ${brl(prev.ontem)} ontem) — mix ou preço cadastrado, não mercado.`,
        impacto: "Recebido acompanha o previsto. O sistema não altera o preço.",
        fonte: "previsto da agenda (cadastro de procedimentos) e baixas",
        direcao: "menos",
        metrica: "recebido",
      });
    }
    return card({
      titulo: `Recebido ${brl(Math.abs(rec.delta))} a menos que ontem`,
      causa: `A agenda e o previsto não explicam a queda sozinhos. Fonte só confirma o recebido das baixas.`,
      impacto: "Não inventamos o motivo. Abra as baixas do dia.",
      fonte: "baixas do financeiro",
      direcao: "menos",
      metrica: "recebido",
    });
  }

  if (age?.direcao === "mais") {
    return card({
      titulo: `Recebido ${brl(Math.abs(rec.delta))} a mais que ontem`,
      causa: `Houve mais horários na agenda (${age.hoje} hoje, ${age.ontem} ontem).`,
      impacto: "Maior volume. Não é garantia de margem.",
      fonte: "agenda do dia e baixas do financeiro",
      direcao: "mais",
      metrica: "recebido",
    });
  }
  if (baixasMais) {
    return card({
      titulo: `Recebido ${brl(Math.abs(rec.delta))} a mais que ontem`,
      causa: `Houve mais baixas (${baixasHoje} hoje, ${baixasOntem} ontem).`,
      impacto: "Mais previsto virou recebido. Sem WhatsApp automático.",
      fonte: "baixas do financeiro ligadas à agenda",
      direcao: "mais",
      metrica: "recebido",
    });
  }
  if (prev?.direcao === "mais") {
    return card({
      titulo: `Recebido ${brl(Math.abs(rec.delta))} a mais que ontem`,
      causa: `O previsto da agenda subiu (${brl(prev.hoje)} hoje, ${brl(prev.ontem)} ontem).`,
      impacto: "Mix ou preço cadastrado. O sistema não muda o preço.",
      fonte: "previsto da agenda e baixas",
      direcao: "mais",
      metrica: "recebido",
    });
  }
  return card({
    titulo: `Recebido ${brl(Math.abs(rec.delta))} a mais que ontem`,
    causa: "A variação está nas baixas; agenda e previsto não apontam o mesmo sentido.",
    impacto: "Não inventamos o motivo extra.",
    fonte: "baixas do financeiro",
    direcao: "mais",
    metrica: "recebido",
  });
}

function explicarPrevisto(linhas) {
  const prev = linhaDe(linhas, "Previsto");
  const age = linhaDe(linhas, "Agendamentos");
  if (!prev || prev.direcao === "igual") return null;
  if (age && age.direcao === prev.direcao) {
    return card({
      titulo: `Previsto ${brl(Math.abs(prev.delta))} ${prev.direcao === "mais" ? "a mais" : "a menos"} que ontem`,
      causa: `A quantidade de horários foi no mesmo sentido (${age.hoje} hoje, ${age.ontem} ontem).`,
      impacto: "Previsto usa o valor cadastrado do procedimento. Não é preço de mercado.",
      fonte: "agenda do dia × cadastro de procedimentos",
      direcao: prev.direcao,
      metrica: "previsto",
    });
  }
  return card({
    titulo: `Previsto ${brl(Math.abs(prev.delta))} ${prev.direcao === "mais" ? "a mais" : "a menos"} que ontem`,
    causa: "A quantidade de horários não acompanhou o previsto — mudou o mix de procedimentos da agenda.",
    impacto: "O sistema não altera o preço cobrado.",
    fonte: "agenda do dia × cadastro de procedimentos",
    direcao: prev.direcao,
    metrica: "previsto",
  });
}

function explicarEstoque(consumoHoje, consumoOntem) {
  if (consumoHoje == null || consumoOntem == null) return null;
  const h = round2(consumoHoje) ?? 0;
  const o = round2(consumoOntem) ?? 0;
  if (h === 0 && o === 0) return null;
  const d = round2(h - o) ?? 0;
  if (Math.abs(d) < 0.009) return null;
  const direcao = d > 0 ? "mais" : "menos";
  return card({
    titulo: `Consumo de estoque ${direcao === "mais" ? "subiu" : "caiu"} vs ontem`,
    causa: `Quantidade consumida: ${h} hoje, ${o} ontem (unidades lançadas).`,
    impacto:
      direcao === "mais"
        ? "Mais insumo no dia. A margem pode apertar; o sistema não muda preço nem trava atendimento."
        : "Menos insumo no dia. Não inventamos o custo em reais se o lote não informou.",
    fonte: "estoque_consumo do dia (ligado à operação)",
    direcao,
    metrica: "estoque",
  });
}

/**
 * Variação explicada. Sem LLM. Sem número fora dos fatos.
 */
export function explicarVariacao({
  agendaHoje = 0,
  agendaOntem = 0,
  previstoHoje = 0,
  previstoOntem = 0,
  recebidoHoje = 0,
  recebidoOntem = 0,
  baixasHoje = null,
  baixasOntem = null,
  consumoHoje = null,
  consumoOntem = null,
} = {}) {
  const linhas = linhasMudancaVsOntem({
    agendaHoje,
    agendaOntem,
    previstoHoje,
    previstoOntem,
    entradasHoje: recebidoHoje,
    entradasOntem: recebidoOntem,
  });
  const extra = { baixasHoje, baixasOntem };
  const out = [];
  const rec = explicarRecebido(linhas, extra);
  if (rec) out.push(rec);
  const prev = explicarPrevisto(linhas);
  if (prev && prev.metrica !== rec?.metrica) out.push(prev);
  const est = explicarEstoque(consumoHoje, consumoOntem);
  if (est) out.push(est);
  if (!out.length) {
    out.push(
      card({
        titulo: "Variação vs ontem",
        causa: MSG_SEM_VARIACAO,
        impacto: "Nenhuma ação automática.",
        fonte: "agenda, previsto e baixas do dia",
        direcao: "igual",
        metrica: "nenhuma",
      })
    );
  }
  return { linhas, cards: out.slice(0, 3) };
}
