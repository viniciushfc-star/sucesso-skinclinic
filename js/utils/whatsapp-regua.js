/**
 * Régua de WhatsApp e silêncio humano.
 * Sugere o próximo clique. Não dispara sozinho. Sem lista.
 */

export const SILENCIO_EVENT_TYPE = "whatsapp_silencio";
export const PREFIXO_SILENCIO = "whatsapp_silencio:";

export const REGUA_PASSOS = [
  { id: "lembrete_1", label: "1ª confirmação (agenda)" },
  { id: "lembrete_2", label: "2ª confirmação (agenda)" },
  { id: "pos", label: "Pós-atendimento (humano clica)" },
  { id: "fila", label: "Fila CRM (um clique)" },
];

export function payloadSilencio(clientId, { off = false, ate = null } = {}) {
  if (!clientId) return null;
  const rest = off ? "off" : ate ? String(ate).slice(0, 10) : "indefinido";
  return {
    client_id: clientId,
    event_type: SILENCIO_EVENT_TYPE,
    description: `${PREFIXO_SILENCIO}${rest}`,
    is_critical: false,
    created_by_client: false,
  };
}

export function leituraSilencio(e) {
  if (String(e?.event_type || "") !== SILENCIO_EVENT_TYPE) return null;
  const d = String(e.description || "");
  if (!d.startsWith(PREFIXO_SILENCIO)) return null;
  const rest = d.slice(PREFIXO_SILENCIO.length).trim();
  if (rest === "off") return { ativo: false, ate: null };
  if (rest === "indefinido" || !rest) return { ativo: true, ate: null };
  return { ativo: true, ate: rest.slice(0, 10) };
}

/** Último evento vence. ate vencido = não está em silêncio. */
export function mapaSilencioPorCliente(events, hoje) {
  const map = new Map();
  const list = [...(events || [])].sort((a, b) =>
    String(a.created_at || a.event_date || "").localeCompare(String(b.created_at || b.event_date || ""))
  );
  for (const e of list) {
    const id = e?.client_id;
    const s = leituraSilencio(e);
    if (!id || !s) continue;
    map.set(id, s);
  }
  const day = String(hoje || "").slice(0, 10);
  for (const [id, s] of map) {
    if (!s.ativo) {
      map.delete(id);
      continue;
    }
    if (s.ate && day && s.ate < day) map.delete(id);
  }
  return map;
}

export function estaEmSilencio(map, clientId) {
  return Boolean(clientId && map && map.has(clientId));
}

/**
 * Próximo passo sugerido a partir do último status de log (humano ainda clica).
 */
export function proximoPassoRegua(statusLog, emSilencio) {
  if (emSilencio) {
    return { id: "silencio", label: "Silêncio humano — não sugerir WhatsApp", enviar: false };
  }
  const s = String(statusLog || "");
  if (/agenda_lembrete_2/.test(s)) {
    return { id: "pos", label: "Pós-atendimento (humano clica)", enviar: false };
  }
  if (/agenda_lembrete/.test(s)) {
    return { id: "lembrete_2", label: "2ª confirmação na agenda (clique)", enviar: false };
  }
  if (/crm_fila|crm_espera/.test(s)) {
    return { id: "desfecho", label: "Registrar desfecho na fila", enviar: false };
  }
  return { id: "lembrete_1", label: "1ª confirmação na agenda (clique)", enviar: false };
}
