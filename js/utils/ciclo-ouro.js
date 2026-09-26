/**
 * Elo orçamento → pacote → baixa na agenda → financeiro.
 * Não altera preço de catálogo. Não duplica pacote nem sessão.
 */

import { linhaTotal, round2 } from "./orcamento.js";

export function pacotesDoAceite(items, clientId, orcamentoId) {
  return (items || [])
    .map((it) => {
      const sessoes = Math.max(1, Number(it.sessions) || Number(it.qty) || 1);
      const nome = String(it.name || "").trim() || "Orçamento";
      return {
        client_id: clientId,
        procedure_id: it.procedure_id || null,
        nome_pacote: nome,
        total_sessoes: sessoes,
        valor_pago: linhaTotal(it),
        orcamento_id: orcamentoId || null,
      };
    })
    .filter((p) => p.client_id && p.nome_pacote);
}

/** Já aceito: não gera de novo. Recusado: não gera. */
export function deveGerarPacotesNoAceite(status) {
  const s = String(status || "").toLowerCase();
  if (s === "aceito" || s === "convertido") return false;
  if (s === "recusado") return false;
  return true;
}

export function sugerirPacoteNaAgenda(procedureId, pacotes = []) {
  const list = Array.isArray(pacotes) ? pacotes : [];
  if (!list.length) return null;
  if (procedureId) {
    const match = list.filter((p) => p.procedure_id && p.procedure_id === procedureId);
    if (match.length === 1) return match[0].id;
  }
  if (list.length === 1) return list[0].id;
  return null;
}

/**
 * Com pacote: registra a sessão (valor_pago / sessões) + acréscimo, não o preço cheio de novo.
 * Sem pacote: preço do procedimento + acréscimo.
 */
export function valorFinanceiroNaBaixa({
  pacoteId,
  valorProcedimento,
  acrescimo = 0,
  valorPagoPacote,
  totalSessoes,
} = {}) {
  const extra = Number(acrescimo) > 0 ? Number(acrescimo) : 0;
  if (pacoteId) {
    const total = Number(totalSessoes) > 0 ? Number(totalSessoes) : 1;
    const pago = Number(valorPagoPacote);
    const sessao = Number.isFinite(pago) && pago >= 0 ? round2(pago / total) : 0;
    return round2(sessao + extra);
  }
  const base = Number(valorProcedimento);
  const b = Number.isFinite(base) && base > 0 ? base : 0;
  return round2(b + extra);
}

export function jaConsumiuAgenda(consumos, agendaId) {
  if (!agendaId) return false;
  return (consumos || []).some((c) => c && c.agenda_id === agendaId);
}

/** Data local YYYY-MM-DD + N dias (intervalo típico entre sessões). */
export function addDaysIso(iso, days) {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + (Number(days) || 0));
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Depois da baixa: só oferece próxima se o pacote ainda tem sessão e ainda não há horário futuro.
 * Quem decide é a equipe. WhatsApp não sai daqui.
 */
export function sugerirProximaAcaoNaBaixa({
  sessoesRestantes = 0,
  temAgendaFutura = false,
  dataAtual,
  intervaloDias = 7,
} = {}) {
  const rest = Math.max(0, Number(sessoesRestantes) || 0);
  if (rest <= 0) return { oferecer: false, motivo: "sem_saldo" };
  if (temAgendaFutura) return { oferecer: false, motivo: "ja_tem_proxima", sessoesRestantes: rest };
  const dataSugerida = addDaysIso(dataAtual, intervaloDias);
  const n = rest === 1 ? "1 sessão" : `${rest} sessões`;
  return {
    oferecer: true,
    motivo: "pacote",
    sessoesRestantes: rest,
    dataSugerida,
    titulo: `Ainda restam ${n} do pacote.`,
  };
}
