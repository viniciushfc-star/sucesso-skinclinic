/**
 * Memória do combinado na consulta.
 * Texto curto, sem rascunho de IA. Não dispara WhatsApp.
 */

export const TIPO_COMBINADO = "consulta_combinado";
export const COMBINADO_MAX = 400;

export function sanitizarCombinado(texto) {
  const t = String(texto || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || /ia_preliminar/i.test(t)) return "";
  return t.slice(0, COMBINADO_MAX);
}

export function payloadCombinadoConsulta({ proximoPasso, retornoEm, agendaId } = {}) {
  const description = sanitizarCombinado(proximoPasso);
  if (!description) return null;
  const metadata = { origem: "consulta" };
  if (agendaId) metadata.agenda_id = String(agendaId);
  const ret = String(retornoEm || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ret)) metadata.retorno_em = ret;
  return {
    event_type: TIPO_COMBINADO,
    description,
    is_critical: false,
    created_by_client: false,
    metadata,
  };
}

export function tituloCombinadoNaLinha(eventType) {
  if (String(eventType || "") === TIPO_COMBINADO) return "Combinado na consulta";
  return String(eventType || "Evento");
}
