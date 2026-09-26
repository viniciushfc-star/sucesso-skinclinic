/**
 * Encaixe na lista de espera quando um horário é cancelado.
 * Só sugere; WhatsApp fica no clique humano.
 */

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function procedimentoCompativel(slotProc, waitProc) {
  const a = norm(slotProc);
  const b = norm(waitProc);
  if (!a || !b) return true;
  return a.includes(b) || b.includes(a);
}

/**
 * @param {Array} waitlist
 * @param {{ data?: string, procedimento?: string }} slot
 */
export function matchWaitlistToSlot(waitlist, slot = {}) {
  const data = slot.data ? String(slot.data).slice(0, 10) : "";
  const proc = slot.procedimento || "";
  const abertas = (waitlist || []).filter((w) => !w.status || w.status === "aberta");
  const scored = abertas
    .map((w) => {
      let score = 1;
      const pref = w.preferred_date ? String(w.preferred_date).slice(0, 10) : "";
      if (data && pref === data) score += 3;
      else if (pref && data && pref !== data) score -= 2;
      if (procedimentoCompativel(proc, w.procedure_name)) score += 2;
      else score -= 4;
      return { ...w, score };
    })
    .filter((w) => w.score > 0)
    .sort((a, b) => b.score - a.score || String(a.created_at || "").localeCompare(String(b.created_at || "")));
  return scored;
}
