/**
 * Plano terapêutico na ficha sem marcar horário.
 * Usa client_events (já existe). Não cria agenda, não muda preço.
 */

export const TIPO_PLANO_FICHA = "plano_combinado";

export function tituloPlanoFichaNaLinha(eventType) {
  if (String(eventType || "") === TIPO_PLANO_FICHA) return "Plano combinado";
  return "";
}

export function payloadPlanoFicha({ clientId, planoId, nome } = {}) {
  const cid = String(clientId || "").trim();
  const pid = String(planoId || "").trim();
  const n = String(nome || "").trim() || "Plano terapêutico";
  if (!cid || !pid) return null;
  if (/ia_preliminar/i.test(n)) return null;
  return {
    client_id: cid,
    event_type: TIPO_PLANO_FICHA,
    description: n.slice(0, 120),
    is_critical: false,
    created_by_client: false,
    metadata: { origem: "ficha", plano_id: pid, nome: n.slice(0, 120) },
  };
}

export function jaCombinouPlano(events = [], planoId) {
  const id = String(planoId || "").trim();
  if (!id) return false;
  return (events || []).some((e) => {
    if (String(e?.event_type || "") !== TIPO_PLANO_FICHA) return false;
    return String(e?.metadata?.plano_id || "") === id;
  });
}

export function mesclarPlanosFicha(agendaPlanos = [], events = [], catalogo = []) {
  const byId = new Map();
  for (const p of agendaPlanos || []) {
    if (!p?.id) continue;
    byId.set(p.id, {
      ...p,
      sessoes: Array.isArray(p.sessoes) ? p.sessoes : [],
      origem: "agenda",
    });
  }
  const cat = new Map((catalogo || []).map((p) => [p.id, p]));
  for (const e of events || []) {
    if (String(e?.event_type || "") !== TIPO_PLANO_FICHA) continue;
    const id = String(e?.metadata?.plano_id || "").trim();
    if (!id || byId.has(id)) continue;
    const catP = cat.get(id);
    byId.set(id, {
      id,
      nome: catP?.nome || e.metadata?.nome || e.description || "Plano terapêutico",
      procedimentos: catP?.procedimentos || [],
      sessoes: [],
      sessoes_utilizadas: 0,
      origem: "ficha",
    });
  }
  return [...byId.values()];
}
