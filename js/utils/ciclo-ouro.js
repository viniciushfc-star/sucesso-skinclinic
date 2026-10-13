/**
 * Elo orçamento → pacote → baixa na agenda → financeiro.
 * Não altera preço de catálogo. Não duplica pacote nem sessão.
 */

import { linhaTotal, round2 } from "./orcamento.js";

export function pacotesDoAceite(items, clientId, orcamentoId) {
  return (items || [])
    .filter((it) => {
      const kind = String(it?.kind || "").toLowerCase();
      if (kind === "produto") return false;
      if (it?.product_id && !it?.procedure_id) return false;
      return true;
    })
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

/**
 * Sessões do pacote aceito para a agenda. Sem preço. Sem WhatsApp.
 */
export function sessoesDoPacoteParaAgenda(pacote, procedure = {}) {
  const n = Math.max(1, Number(pacote?.total_sessoes) || 1);
  const nome = String(procedure?.name || procedure?.nome || pacote?.nome_pacote || "").trim() || "Sessão";
  const duration = Number(procedure?.duration_minutes) || 60;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push({
      procedure_id: pacote?.procedure_id || procedure?.id || null,
      procedimento: nome,
      duration_minutes: duration,
      pacote_id: pacote?.id || null,
      sessao: i + 1,
      sessoes: n,
    });
  }
  return out;
}

export function slotsAgendaDoAceite({
  packages = [],
  procedures = [],
  startDate,
  startTime,
  intervalDays = 7,
  onlyFirst = true,
} = {}) {
  const byId = {};
  for (const p of procedures || []) byId[p.id] = p;
  const sessoes = [];
  for (const pk of packages || []) {
    sessoes.push(...sessoesDoPacoteParaAgenda(pk, byId[pk.procedure_id] || {}));
  }
  const use = onlyFirst ? sessoes.slice(0, 1) : sessoes;
  const hora = String(startTime || "09:00").slice(0, 5);
  return use
    .map((s, i) => ({
      ...s,
      data: addDaysIso(startDate, i * (Number(intervalDays) || 7)),
      hora,
    }))
    .filter((s) => s.data && s.hora);
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
