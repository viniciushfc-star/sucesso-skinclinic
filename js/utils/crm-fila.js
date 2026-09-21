/**
 * Fila de contato do CRM: uma pessoa, um motivo, WhatsApp só no clique.
 */

export const CRM_FILA_MAX = 15;

const PRIORIDADE = {
  pacote: 100,
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
  return `Oi, ${n}! Vi seu acompanhamento na ${c} e queria encaixar o retorno.${x} Posso te mandar horários?${link}`;
}
