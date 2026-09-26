/**
 * Origem do lead no CRM (client_events + nota da espera). Sem crm2.
 * CAC só se a clínica informar o investimento. Não dispara mensagem.
 */

export const LEAD_EVENT_TYPE = "lead_origem";
export const PREFIXO_LEAD_ORIGEM = "lead_origem:";
export const PREFIXO_NOTA_ORIGEM = "[origem:";

export const LEAD_ORIGENS = [
  { id: "instagram", label: "Instagram" },
  { id: "indicacao", label: "Indicação" },
  { id: "google", label: "Google" },
  { id: "whatsapp", label: "WhatsApp (clique)" },
  { id: "portal", label: "Portal / site" },
  { id: "espera", label: "Lista de espera" },
  { id: "outro", label: "Outro" },
];

export function labelOrigemLead(id) {
  return LEAD_ORIGENS.find((o) => o.id === id)?.label || "";
}

export function origemValida(id) {
  const s = String(id || "").toLowerCase().trim();
  return LEAD_ORIGENS.some((o) => o.id === s) ? s : "";
}

export function payloadLeadOrigem(clientId, origemId) {
  const origem = origemValida(origemId);
  if (!clientId || !origem) return null;
  return {
    client_id: clientId,
    event_type: LEAD_EVENT_TYPE,
    description: `${PREFIXO_LEAD_ORIGEM}${origem}`,
    is_critical: false,
    created_by_client: false,
  };
}

export function origemDoEvento(e) {
  if (String(e?.event_type || "") !== LEAD_EVENT_TYPE) return "";
  const d = String(e.description || "");
  if (!d.startsWith(PREFIXO_LEAD_ORIGEM)) return "";
  return origemValida(d.slice(PREFIXO_LEAD_ORIGEM.length));
}

/** Primeira origem registrada por cliente (não sobrescreve). */
export function mapaOrigemPorCliente(events) {
  const map = new Map();
  for (const e of events || []) {
    const id = e?.client_id;
    const origem = origemDoEvento(e);
    if (!id || !origem || map.has(id)) continue;
    map.set(id, origem);
  }
  return map;
}

export function origemDaNotaEspera(notes) {
  const m = String(notes || "").match(/^\[origem:([a-z_]+)\]\s*/i);
  return m ? origemValida(m[1]) : "";
}

export function notesComOrigem(notes, origemId) {
  const rest = String(notes || "").replace(/^\[origem:[a-z_]+\]\s*/i, "").trim();
  const origem = origemValida(origemId);
  if (!origem) return rest;
  return rest ? `${PREFIXO_NOTA_ORIGEM}${origem}] ${rest}` : `${PREFIXO_NOTA_ORIGEM}${origem}]`;
}

export function idsConvertidosDesfecho(events, desfecho = "agendou") {
  const ids = new Set();
  for (const e of events || []) {
    const meta = e.metadata || {};
    if (String(e.event_type || "") === "crm_desfecho" && meta.desfecho === desfecho && e.client_id) {
      ids.add(e.client_id);
    }
  }
  return ids;
}

/**
 * @param {{ origemByClient: Map, convertidos: Set, investimento?: number }} args
 */
export function resumirFunilOrigem({ origemByClient, convertidos, investimento } = {}) {
  const by = {};
  for (const o of LEAD_ORIGENS) {
    by[o.id] = { origem: o.id, label: o.label, leads: 0, convertidos: 0 };
  }
  for (const [clientId, origem] of origemByClient || []) {
    if (!by[origem]) continue;
    by[origem].leads += 1;
    if (convertidos && convertidos.has(clientId)) by[origem].convertidos += 1;
  }
  const linhas = Object.values(by).filter((r) => r.leads > 0);
  const totalLeads = linhas.reduce((s, r) => s + r.leads, 0);
  const totalConv = linhas.reduce((s, r) => s + r.convertidos, 0);
  const inv = Number(investimento);
  const cac =
    Number.isFinite(inv) && inv > 0 && totalConv > 0 ? Math.round((inv / totalConv) * 100) / 100 : null;
  return { linhas, totalLeads, totalConv, cac, investimento: cac != null ? inv : null };
}
