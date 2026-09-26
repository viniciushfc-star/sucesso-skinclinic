/**
 * Sala de espera: minutos sentados e rótulo — sem WhatsApp automático.
 */

export function waitingMinutes(arrivedAt, startedAt, now = new Date()) {
  if (!arrivedAt) return 0;
  const start = new Date(arrivedAt).getTime();
  if (Number.isNaN(start)) return 0;
  const end = startedAt ? new Date(startedAt).getTime() : now.getTime();
  if (Number.isNaN(end) || end < start) return 0;
  return Math.floor((end - start) / 60000);
}

export function salaEsperaStatus(row, now = new Date()) {
  if (!row || row.item_type === "event") return { key: "evento", label: "Evento", minutes: 0 };
  if (row.started_at) {
    return { key: "atendimento", label: "Em atendimento", minutes: waitingMinutes(row.arrived_at, row.started_at, now) };
  }
  if (row.arrived_at) {
    const minutes = waitingMinutes(row.arrived_at, null, now);
    return { key: "sala", label: minutes ? `Na espera (${minutes} min)` : "Na espera", minutes };
  }
  return null;
}
