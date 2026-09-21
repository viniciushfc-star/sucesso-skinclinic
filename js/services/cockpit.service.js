/**
 * Cockpit operacional: o que olhar agora (não gráficos).
 * Falha de tabela/permissão vira lista vazia — o dia continua.
 */

import { listAppointmentsByDate } from "./appointments.service.js";
import { listProcedures } from "./procedimentos.service.js";
import { listInactiveClients, getRadarRetorno } from "./crm.service.js";
import { listWaitlist } from "./waitlist.service.js";
import { listAnalisesPele } from "./analise-pele.service.js";
import { listContasAPagar } from "./contas-a-pagar.service.js";
import { getTodayLocal, getPeriodRange, getDashboardMetricsForUser, getRankingProcedimentosComReceita } from "./metrics.service.js";
import { getMargemEmRisco } from "./audit.service.js";
import { horaAgenda, statusAgendaItem } from "./cockpit-status.js";
import { buildAttentionInsights, buildOpportunityInsights } from "./intelligence.service.js";
import { explainFinanceiroMetas } from "./financeiro-metas.service.js";

export { statusAgendaItem, horaAgenda };

async function soft(fn) {
  try {
    const v = await fn();
    return v ?? [];
  } catch {
    return [];
  }
}

function hhmmNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isEvent(a) {
  return a.item_type === "event";
}

function clienteNome(a) {
  const c = a.clients || a.clientes || {};
  return c.name || c.nome || "—";
}

export async function getCockpitSnapshot() {
  const hoje = getTodayLocal();
  const now = hhmmNow();

  const [appointments, procedures, inativos, espera, analises, contas, radar, margem] = await Promise.all([
    soft(() => listAppointmentsByDate(hoje)),
    soft(() => listProcedures(true)),
    soft(() => listInactiveClients(90)),
    soft(() => listWaitlist("aberta")),
    soft(() => listAnalisesPele("pending_validation")),
    soft(() => listContasAPagar()),
    soft(() => getRadarRetorno({ minDaysInativa: 60 })),
    soft(() => getMargemEmRisco(30)),
  ]);

  const procMap = (procedures || []).reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});

  let previsto = 0;
  let confirmados = 0;
  let atrasos = 0;
  const itens = [];

  for (const a of appointments) {
    const st = statusAgendaItem(a, now);
    if (st.key === "ok") confirmados += 1;
    if (st.key === "atraso") atrasos += 1;
    itens.push({
      id: a.id,
      hora: horaAgenda(a),
      nome: isEvent(a) ? a.event_title || "Evento" : clienteNome(a),
      proc: isEvent(a) ? a.event_type || "" : a.procedimento || "Agendamento",
      status: st,
      clientId: a.cliente_id || a.client_id || null,
    });
    if (isEvent(a) || a.is_retorno) continue;
    if (a.procedure_id && procMap[a.procedure_id]?.valor_cobrado != null) {
      let v = Number(procMap[a.procedure_id].valor_cobrado);
      if (!Number.isNaN(v) && v > 0) {
        if (a.is_modelo_agendamento && a.desconto_modelo_pct != null) {
          v = v * (1 - Number(a.desconto_modelo_pct) / 100);
        }
        previsto += v;
      }
    }
  }

  const contasVencidas = (contas || []).filter((c) => {
    if (!c || c.status === "pago" || c.data_pago) return false;
    const d = String(c.data_vencimento || "").slice(0, 10);
    return d && d <= hoje;
  });

  const radarFila = (radar || []).filter((r) => r.sinal && r.sinal !== "inativa");
  const produtosRisco = [...new Set((margem || []).map((x) => x.produto_nome).filter(Boolean))];

  return {
    hoje,
    kpis: {
      hojeCount: appointments.length,
      confirmados,
      atrasos,
      previsto,
    },
    agenda: itens,
    atencao: buildAttentionInsights({
      atrasos,
      contasVencidas: contasVencidas.length,
      analisesPendentes: (analises || []).length,
      inativos: (inativos || []).length,
      produtosRisco: produtosRisco.length,
    }),
    oportunidades: buildOpportunityInsights({
      espera: (espera || []).length,
      radar: radarFila.length,
    }),
  };
}

export async function getCockpitMesSnapshot() {
  const { startDate, endDate } = getPeriodRange("month");
  const ym = String(startDate || "").slice(0, 7);
  const [metrics, ranking, margem, metas] = await Promise.all([
    (async () => {
      try {
        return await getDashboardMetricsForUser({ startDate, endDate });
      } catch {
        return { clientes: 0, agendamentosHoje: 0, faturamentoMes: 0 };
      }
    })(),
    (async () => {
      try {
        return await getRankingProcedimentosComReceita(startDate, endDate, 5);
      } catch {
        return [];
      }
    })(),
    (async () => {
      try {
        return await getMargemEmRisco(30);
      } catch {
        return [];
      }
    })(),
    soft(() => explainFinanceiroMetas()),
  ]);

  const produtosRisco = [...new Set((margem || []).map((x) => x.produto_nome).filter(Boolean))];
  const metasMes = (metas || []).filter(
    (m) =>
      (m.tipo === "receita_mensal" || m.tipo === "lucro_mensal") &&
      String(m.periodo_ref || m.start || "").startsWith(ym)
  );

  return {
    startDate,
    endDate,
    kpis: {
      clientes: metrics.clientes ?? 0,
      sessoes: metrics.agendamentosHoje ?? 0,
      faturamento: metrics.faturamentoMes ?? 0,
    },
    ranking: ranking || [],
    produtosRisco,
    metasMes,
  };
}
