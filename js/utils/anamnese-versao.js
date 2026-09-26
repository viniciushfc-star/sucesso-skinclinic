/**
 * Anamnese evolutiva: cada salvamento é versão nova. Não apaga a anterior.
 */

function isoTime(r) {
  return String(r?.created_at || "");
}

function stableJson(v) {
  if (v == null) return "null";
  if (typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableJson).join(",") + "]";
  const keys = Object.keys(v).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableJson(v[k])).join(",") + "}";
}

export function mapaVersaoAnamnese(registros, groupKey) {
  const keyOf = typeof groupKey === "function"
    ? groupKey
    : (r) => r.funcao_id || r.anamnesis_funcoes?.slug || "geral";
  const groups = new Map();
  const ordered = [...(registros || [])].sort((a, b) => isoTime(a).localeCompare(isoTime(b)));
  for (const r of ordered) {
    if (!r?.id) continue;
    const k = keyOf(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const map = {};
  for (const list of groups.values()) {
    const total = list.length;
    list.forEach((r, i) => {
      map[r.id] = { n: i + 1, total };
    });
  }
  return map;
}

export function rotuloVersaoAnamnese(info) {
  if (!info || !info.n) return "";
  return `Versão ${info.n} de ${info.total}`;
}

export function ehDuplicataDaUltima({ ficha, conteudo, conduta, fotosCount, ultima } = {}) {
  if (!ultima) return false;
  if (Number(fotosCount) > 0) return false;
  if (String(conteudo || "").trim() !== String(ultima.conteudo || "").trim()) return false;
  if (String(conduta || "").trim() !== String(ultima.conduta_tratamento || "").trim()) return false;
  return stableJson(ficha || {}) === stableJson(ultima.ficha || {});
}
