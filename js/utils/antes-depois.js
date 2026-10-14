/**
 * Pares antes/depois no prontuário.
 * Casa pelo procedimento (ou nota) e pela data. Não publica em rede.
 */

function isoDay(v) {
  return String(v || "").slice(0, 10);
}

function byDateAsc(a, b) {
  return isoDay(a?.taken_at).localeCompare(isoDay(b?.taken_at));
}

function diasEntre(a, b) {
  const da = new Date(`${isoDay(a)}T12:00:00`);
  const db = new Date(`${isoDay(b)}T12:00:00`);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function chaveParFoto(ph) {
  const proc = String(ph?.procedure_id || "").trim();
  if (proc) return `p:${proc}`;
  const n = String(ph?.notes || "").trim().toLowerCase();
  if (n) return `n:${n}`;
  return "geral";
}

export function ehDepois(ph) {
  return String(ph?.type || "").toLowerCase() === "depois";
}

/**
 * @returns {{ pares: Array<{ chave: string, antes: object, depois: object, intervaloDias: number|null }>, soltas: object[] }}
 */
export function paresAntesDepois(photos = []) {
  const list = (photos || []).filter((p) => p && (p.id || p.photo_url));
  const used = new Set();
  const groups = new Map();
  for (const ph of list) {
    const k = chaveParFoto(ph);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(ph);
  }
  const pares = [];
  for (const [chave, group] of groups) {
    const antes = group.filter((p) => !ehDepois(p)).sort(byDateAsc);
    const depois = group.filter((p) => ehDepois(p)).sort(byDateAsc);
    for (const d of depois) {
      const a = antes.find((x) => !used.has(x.id) && isoDay(x.taken_at) <= isoDay(d.taken_at));
      if (!a) continue;
      used.add(a.id);
      used.add(d.id);
      pares.push({
        chave,
        antes: a,
        depois: d,
        intervaloDias: diasEntre(a.taken_at, d.taken_at),
      });
    }
  }
  pares.sort((x, y) => isoDay(y.depois?.taken_at).localeCompare(isoDay(x.depois?.taken_at)));
  return {
    pares,
    soltas: list.filter((p) => !used.has(p.id)),
  };
}

export function indicesParPadrao(photos = [], par = null) {
  const list = photos || [];
  const alvo = par || paresAntesDepois(list).pares[0] || null;
  if (!alvo) {
    return { i1: 0, i2: list.length > 1 ? 1 : 0 };
  }
  const i1 = list.findIndex((p) => p.id === alvo.antes?.id);
  const i2 = list.findIndex((p) => p.id === alvo.depois?.id);
  return {
    i1: i1 >= 0 ? i1 : 0,
    i2: i2 >= 0 ? i2 : list.length > 1 ? 1 : 0,
  };
}

export function rotuloParEvolucao(par, procMap = {}) {
  const procId = par?.antes?.procedure_id || par?.depois?.procedure_id;
  const proc = procId ? procMap[procId] || "" : "";
  const notes = String(par?.antes?.notes || par?.depois?.notes || "").trim();
  const dias = par?.intervaloDias;
  const bits = [];
  if (proc) bits.push(proc);
  if (notes) bits.push(notes);
  if (dias != null && dias >= 0) bits.push(dias === 1 ? "1 dia entre as fotos" : `${dias} dias entre as fotos`);
  return bits.join(" · ") || "Par de evolução";
}
