/** P2-4 — plano terapêutico vira sessões na agenda. Sem auto-preço. */

export const PLANO_AGENDA_INTERVAL_DAYS = 7;

export function expandPlanoSessoes(links, proceduresById = new Map()) {
  const ordered = [...(links || [])].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const out = [];
  for (const link of ordered) {
    const n = Math.max(1, Number(link.quantidade) || 1);
    const proc = proceduresById.get(link.procedure_id) || {};
    const nome = proc.name || proc.nome || "";
    const duration = Number(proc.duration_minutes) || 60;
    for (let i = 0; i < n; i += 1) {
      out.push({
        procedure_id: link.procedure_id || null,
        procedimento: nome,
        duration_minutes: duration,
      });
    }
  }
  return out;
}

export function addCalendarDays(ymd, days) {
  const [y, m, d] = String(ymd || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function buildPlanoAgendaSlots({
  startDate,
  startTime,
  sessoes,
  intervalDays = PLANO_AGENDA_INTERVAL_DAYS,
  onlyFirst = false,
}) {
  const list = sessoes || [];
  const use = onlyFirst ? list.slice(0, 1) : list;
  return use.map((s, i) => ({
    ...s,
    data: addCalendarDays(startDate, i * intervalDays),
    hora: startTime,
    sessao_plano: i + 1,
    sessoes_plano: list.length,
    plano_id: s.plano_id || null,
  }));
}
