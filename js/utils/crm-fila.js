/**
 * Fila de contato do CRM: uma pessoa, um motivo, WhatsApp só no clique.
 */

export const CRM_FILA_MAX = 15;

const PRIORIDADE = {
  pacote: 100,
  plano_fim: 95,
  espera: 90,
  nova_sem_2: 80,
  atrasada: 70,
  sem_proxima: 60,
  fidelidade: 55,
  aniversario: 50,
  inativa: 30,
};

export function prioridadeSinal(sinal) {
  return PRIORIDADE[sinal] || 10;
}

function phoneKey(phone) {
  return String(phone || "").replace(/\D/g, "").slice(-11);
}

function personKey(item) {
  if (item.clientId) return `id:${item.clientId}`;
  const p = phoneKey(item.phone);
  if (p.length >= 10) return `tel:${p}`;
  return `nome:${String(item.name || "").trim().toLowerCase()}`;
}

/**
 * Junta radar, espera, fidelidade e aniversário. Uma linha por pessoa (maior prioridade).
 */
export function buildCrmFila(chunks, limit = CRM_FILA_MAX) {
  const map = new Map();
  for (const item of chunks || []) {
    if (!item || !item.name) continue;
    const key = personKey(item);
    const score = prioridadeSinal(item.sinal);
    const prev = map.get(key);
    if (!prev || score > prev.score) {
      map.set(key, { ...item, score });
    }
  }
  return [...map.values()]
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name), "pt"))
    .slice(0, Math.max(0, limit));
}

export const CRM_EVENT_TYPE = "crm_desfecho";

export const CRM_DESFECHOS = [
  { id: "contactado", label: "Falei" },
  { id: "agendou", label: "Agendou" },
  { id: "nao_respondeu", label: "Sem resposta" },
  { id: "nao_quis", label: "Não quis" },
];

export function labelDesfecho(id) {
  return CRM_DESFECHOS.find((d) => d.id === id)?.label || "";
}

export function payloadDesfecho({ clientId, sinal, desfecho, hoje } = {}) {
  const d = CRM_DESFECHOS.find((x) => x.id === desfecho);
  if (!d || !clientId) return null;
  const day = String(hoje || "").slice(0, 10);
  return {
    client_id: clientId,
    event_type: CRM_EVENT_TYPE,
    description: `CRM: ${d.label}${sinal ? ` (${sinal})` : ""}`,
    event_date: day || undefined,
    metadata: { origem: "crm_fila", desfecho: d.id, sinal: sinal || "" },
  };
}

function daysBetweenIso(fromIso, hojeIso) {
  const a = String(fromIso || "").slice(0, 10);
  const b = String(hojeIso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return Infinity;
  const da = new Date(`${a}T12:00:00`);
  const db = new Date(`${b}T12:00:00`);
  return Math.floor((db.getTime() - da.getTime()) / 86400000);
}

/** Último desfecho por cliente (eventos mais recentes primeiro). */
export function mapaUltimoDesfecho(eventos) {
  const map = new Map();
  const rows = [...(eventos || [])].sort((x, y) =>
    String(y.event_date || "").localeCompare(String(x.event_date || ""))
  );
  for (const e of rows) {
    if (String(e.event_type || "") !== CRM_EVENT_TYPE) continue;
    const id = e.client_id;
    if (!id || map.has(id)) continue;
    const desfecho = e.metadata?.desfecho || "";
    map.set(id, {
      desfecho,
      event_date: e.event_date,
      label: labelDesfecho(desfecho) || e.description || "",
    });
  }
  return map;
}

/**
 * Tira da fila quem recusou (30 dias) ou já agendou (14 dias). Sem resposta continua.
 */
export function filtrarFilaPorDesfecho(fila, ultimoPorCliente, hoje, opts = {}) {
  const diasNaoQuis = Number(opts.diasNaoQuis) > 0 ? Number(opts.diasNaoQuis) : 30;
  const diasAgendou = Number(opts.diasAgendou) > 0 ? Number(opts.diasAgendou) : 14;
  const map = ultimoPorCliente instanceof Map ? ultimoPorCliente : new Map();
  return (fila || []).filter((item) => {
    if (!item?.clientId) return true;
    const u = map.get(item.clientId);
    if (!u?.desfecho) return true;
    const n = daysBetweenIso(u.event_date, hoje);
    if (u.desfecho === "nao_quis" && n < diasNaoQuis) return false;
    if (u.desfecho === "agendou" && n < diasAgendou) return false;
    return true;
  });
}

/**
 * Um sinal por pessoa. Quem já tem horário futuro não entra no radar.
 * WhatsApp continua só no clique (a view decide).
 */
export function classificarSinalRadar({
  visits = 0,
  idleDays = Infinity,
  hasFuture = false,
  packRest = 0,
  packEnded = false,
  packNome = "",
  medianGap = null,
  minDaysInativa = 60,
} = {}) {
  const minDays = Math.max(21, Number(minDaysInativa) || 60);
  const idle = Number(idleDays);
  const n = Number(visits) || 0;
  const rest = Math.max(0, Number(packRest) || 0);
  if (hasFuture) return { sinal: null, motivo: "", acao: "" };
  if (rest > 0) {
    return {
      sinal: "pacote",
      motivo: `Pacote ativo com ${rest} sessão(ões) e sem próximo horário.`,
      acao: "Agendar retorno",
    };
  }
  if (packEnded) {
    const nome = String(packNome || "").trim();
    return {
      sinal: "plano_fim",
      motivo: nome
        ? `Pacote/plano encerrado (${nome}). Sem próximo horário.`
        : "Pacote ou plano encerrado. Sem próximo horário.",
      acao: "Agendar retorno",
    };
  }
  if (n === 1 && Number.isFinite(idle) && idle >= 14) {
    return {
      sinal: "nova_sem_2",
      motivo: "Veio 1 vez e não tem 2º atendimento.",
      acao: "Agendar retorno",
    };
  }
  if (
    n >= 3 &&
    medianGap &&
    Number.isFinite(idle) &&
    idle > Math.max(14, Number(medianGap) * 1.25)
  ) {
    return {
      sinal: "atrasada",
      motivo: `Ritmo pessoal ~${Math.round(Number(medianGap))} dia(s); última visita há ${idle} dia(s).`,
      acao: "Agendar retorno",
    };
  }
  if (n >= 1 && Number.isFinite(idle) && idle < minDays) {
    return {
      sinal: "sem_proxima",
      motivo: "Já veio e não há sessão futura na agenda.",
      acao: "Agendar retorno",
    };
  }
  if (Number.isFinite(idle) && idle >= minDays) {
    return {
      sinal: "inativa",
      motivo: `Sem visita há ${idle} dia(s) (limiar ${minDays}).`,
      acao: "Entrar em contato",
    };
  }
  return { sinal: null, motivo: "", acao: "" };
}

export function filaWhatsappTemplate({ name, sinal, clinic, agendarUrl, extra = "" }) {
  const n = String(name || "").trim() || "oi";
  const c = String(clinic || "nossa clínica");
  const link = agendarUrl ? ` ${agendarUrl}` : "";
  const x = extra ? ` ${extra}` : "";
  if (sinal === "espera") {
    return `Oi, ${n}! Abriu um horário na ${c}.${x} Ainda quer?${link}`;
  }
  if (sinal === "aniversario") {
    return `Feliz aniversário, ${n}!${x} Quer um horário na ${c}?${link}`;
  }
  if (sinal === "fidelidade") {
    return `Oi, ${n}!${x} Te encaixo na ${c}?${link}`;
  }
  if (sinal === "plano_fim") {
    return `Oi, ${n}! Encerramos o combinado na ${c}.${x} Quer marcar a manutenção?${link}`;
  }
  return `Oi, ${n}! Vi seu acompanhamento na ${c} e queria encaixar o retorno.${x} Posso te mandar horários?${link}`;
}
