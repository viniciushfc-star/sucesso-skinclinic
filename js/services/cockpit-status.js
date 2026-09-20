export function horaAgenda(a) {
  const s = String(a?.hora || "");
  if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
  return s || "—";
}

export function statusAgendaItem(a, nowHhmm) {
  if (a?.item_type === "event") return { key: "evento", label: "Evento" };
  const st = String(a?.status || "").toLowerCase();
  if (st === "released" || a?.baixa_em) return { key: "feito", label: "Baixa" };
  if (st === "confirmed" || a?.confirmed_at) return { key: "ok", label: "Confirmado" };
  const h = horaAgenda(a);
  if (h !== "—" && nowHhmm && h < nowHhmm) return { key: "atraso", label: "Atraso" };
  return { key: "espera", label: "Aguarda" };
}
