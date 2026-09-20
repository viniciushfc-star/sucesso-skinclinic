/**
 * Cockpit operacional: o que olhar agora (não gráficos).
 * Falha de tabela/permissão vira lista vazia — o dia continua.
 */

import { listAppointmentsByDate } from "./appointments.service.js";
import { listProcedures } from "./procedimentos.service.js";
import { listInactiveClients } from "./crm.service.js";
import { listWaitlist } from "./waitlist.service.js";
import { listAnalisesPele } from "./analise-pele.service.js";
import { listContasAPagar } from "./contas-a-pagar.service.js";
import { getTodayLocal } from "./metrics.service.js";
import { horaAgenda, statusAgendaItem } from "./cockpit-status.js";

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

  const [appointments, procedures, inativos, espera, analises, contas] = await Promise.all([
    soft(() => listAppointmentsByDate(hoje)),
    soft(() => listProcedures(true)),
    soft(() => listInactiveClients(90)),
    soft(() => listWaitlist("aberta")),
    soft(() => listAnalisesPele("pending_validation")),
    soft(() => listContasAPagar()),
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

  return {
    hoje,
    kpis: {
      hojeCount: appointments.length,
      confirmados,
      atrasos,
      previsto,
    },
    agenda: itens,
    atencao: {
      inativos: (inativos || []).slice(0, 8),
      analises: (analises || []).slice(0, 8),
      contas: contasVencidas.slice(0, 8),
    },
    oportunidades: {
      espera: (espera || []).slice(0, 8),
    },
  };
}
