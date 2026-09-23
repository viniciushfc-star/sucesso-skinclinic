/**
 * Ocupação de profissionais esporádicos / agenda pessoal.
 * A clínica vê só livre/ocupado (horário). Sem título, paciente ou local do Google.
 */

export const DEFAULT_TRAVEL_MINUTES = 40;
export const MAX_SEQUENCIA_CLINICA_MINUTES = 4 * 60;
export const MAX_JORNADA_CLINICA_MINUTES = 8 * 60;
/** Pausa que quebra uma sequência longa (além do respiro curto entre sessões). */
export const PAUSA_QUEBRA_SEQUENCIA_MINUTES = 20;

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

export function expandWithTravel(startMs, endMs, travelMin = DEFAULT_TRAVEL_MINUTES) {
  const t = Math.max(0, Number(travelMin) || 0) * 60000;
  return { start: startMs - t, end: endMs + t };
}

export function formatHHmm(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function labelOcupadoPessoal() {
  return "Ocupado (agenda pessoal)";
}

/**
 * Conflito com compromisso externo + tempo de chegar/sair da clínica.
 */
export function conflitoExternoComDeslocamento(slotStart, slotEnd, blocks, travelMin = DEFAULT_TRAVEL_MINUTES) {
  const travel = Math.max(0, Number(travelMin) || DEFAULT_TRAVEL_MINUTES);
  for (const b of blocks || []) {
    const bStart = new Date(b.start_at).getTime();
    const bEnd = new Date(b.end_at).getTime();
    if (!bStart || !bEnd || bEnd <= bStart) continue;
    const exp = expandWithTravel(bStart, bEnd, travel);
    if (rangesOverlap(slotStart.getTime(), slotEnd.getTime(), exp.start, exp.end)) {
      const ini = new Date(bStart);
      const fim = new Date(bEnd);
      return {
        inicio: formatHHmm(ini),
        fim: formatHHmm(fim),
        procedimento: labelOcupadoPessoal(),
        respiroNecessario: travel,
        motivo: `Reserve ${travel} min para o profissional chegar à clínica e sair a tempo do próximo compromisso.`,
      };
    }
  }
  return null;
}

function mergeSequencias(slotsMs, gapMaxMs) {
  const sorted = [...slotsMs].sort((a, b) => a.start - b.start);
  const out = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start - last.end <= gapMaxMs) {
      last.end = Math.max(last.end, s.end);
    } else {
      out.push({ start: s.start, end: s.end });
    }
  }
  return out;
}

/**
 * Dia insalubre: jornada clínica longa demais, ou várias horas seguidas sem pausa de verdade.
 * clinicSlots: [{ start: Date|number, end: Date|number }] já incluindo o slot novo.
 */
export function avaliarJornadaClinica(clinicSlots, {
  maxSequenciaMin = MAX_SEQUENCIA_CLINICA_MINUTES,
  maxDiaMin = MAX_JORNADA_CLINICA_MINUTES,
  pausaQuebraMin = PAUSA_QUEBRA_SEQUENCIA_MINUTES,
} = {}) {
  const slots = (clinicSlots || [])
    .map((s) => ({
      start: s.start instanceof Date ? s.start.getTime() : Number(s.start),
      end: s.end instanceof Date ? s.end.getTime() : Number(s.end),
    }))
    .filter((s) => s.end > s.start);
  const totalMin = slots.reduce((acc, s) => acc + (s.end - s.start) / 60000, 0);
  if (totalMin > maxDiaMin) {
    return {
      ok: false,
      motivo: `A jornada na clínica passaria de ${Math.round(maxDiaMin / 60)} h neste dia.`,
    };
  }
  const merged = mergeSequencias(slots, pausaQuebraMin * 60000);
  for (const m of merged) {
    const seqMin = (m.end - m.start) / 60000;
    if (seqMin > maxSequenciaMin) {
      return {
        ok: false,
        motivo: `Ficariam mais de ${Math.round(maxSequenciaMin / 60)} h seguidas sem pausa real para o profissional.`,
      };
    }
  }
  return { ok: true };
}

/** Busy do Google que coincide com atendimento da clínica não vira “agenda pessoal”. */
export function busyMenosAgendaClinica(busy, clinicSlots) {
  return (busy || []).filter((b) => {
    const bStart = new Date(b.start).getTime();
    const bEnd = new Date(b.end).getTime();
    if (!bStart || !bEnd) return false;
    const echo = (clinicSlots || []).some((c) => {
      const cStart = c.start instanceof Date ? c.start.getTime() : new Date(c.start).getTime();
      const cEnd = c.end instanceof Date ? c.end.getTime() : new Date(c.end).getTime();
      return rangesOverlap(bStart, bEnd, cStart, cEnd);
    });
    return !echo;
  });
}

export function publicSubmitOccupyBody(json) {
  return {
    ok: !!json?.ok,
    skipped: !!json?.skipped,
    needs_reconnect: !!json?.needs_reconnect,
  };
}
