function toMinutes(hhmm) {
  const part = String(hhmm || "").slice(0, 5);
  const [h, m] = part.split(":").map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function rangesOverlap(aStart, aDur, bStart, bDur) {
  return aStart < bStart + bDur && bStart < aStart + aDur;
}

/**
 * Horários de 09:00 às 18:00 a cada 30 min.
 * busy: "HH:MM" (ocupa só aquele tick) ou { hora, duration_minutes }.
 * durationMinutes: duração do procedimento que a cliente quer marcar.
 */
export function buildFreeSlots(busyHHmm, dateYmd, durationMinutes = 60) {
  const wantDur = Math.max(30, Number(durationMinutes) || 60);
  const busy = [];
  for (const item of busyHHmm || []) {
    if (item && typeof item === "object") {
      const start = toMinutes(item.hora);
      if (start == null) continue;
      busy.push({
        start,
        duration: Math.max(30, Number(item.duration_minutes) || 60),
      });
    } else {
      const start = toMinutes(item);
      if (start == null) continue;
      busy.push({ start, duration: 30 });
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const slots = [];
  for (let m = 9 * 60; m < 18 * 60; m += 30) {
    if (m + wantDur > 18 * 60) break;
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    const label = `${hh}:${mm}`;
    if (busy.some((b) => rangesOverlap(m, wantDur, b.start, b.duration))) continue;
    if (dateYmd === today && m <= nowMin + 30) continue;
    slots.push(label);
  }
  return slots;
}
