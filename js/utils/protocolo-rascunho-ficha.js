/**
 * Rascunho do que foi feito na ficha. Humano confirma. Não grava, não precifica.
 */

function nome(s) {
  return String(s || "").trim();
}

function unique(list) {
  const seen = new Set();
  const out = [];
  for (const n of list || []) {
    const t = nome(n);
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export function textoRascunhoLocal({ protocolo, sessoes = [] } = {}) {
  const parts = [];
  const steps = nome(protocolo?.descricao_passos);
  const protoNome = nome(protocolo?.nome);
  if (protoNome) parts.push(protoNome);
  if (steps) parts.push(steps);
  const rec = unique((sessoes || []).map((s) => s?.procedimento));
  if (!steps && rec.length) parts.push(rec.join(", "));
  return parts.join("\n").trim();
}

export function produtosRascunhoLocal(descartaveis = []) {
  return (descartaveis || [])
    .map((p) => ({
      produto_nome: nome(p?.produto_nome),
      quantidade: Math.max(0, Number(p?.quantidade) || 1),
    }))
    .filter((p) => p.produto_nome);
}

function semPreco(s) {
  return nome(s).replace(/R\$\s*[\d.,]+/gi, "").replace(/\s{2,}/g, " ").trim();
}

function nomesDeProcedimentosIa(raw) {
  if (Array.isArray(raw)) {
    return unique(
      raw.map((p) => {
        if (typeof p === "string") return semPreco(p);
        return semPreco(p?.nome || p?.procedimento || p?.name);
      })
    );
  }
  return [];
}

/**
 * Converte a resposta de /api/protocolo em texto de rascunho (sem preço).
 */
export function textoRascunhoDeIa(content) {
  const raw = typeof content === "string" ? content : content == null ? "" : JSON.stringify(content);
  let obj = null;
  try {
    obj = JSON.parse(raw);
  } catch (_) {
    const t = semPreco(raw);
    return t && t !== "{}" ? t.slice(0, 800) : "";
  }
  if (!obj || typeof obj !== "object") return "";
  const procs = nomesDeProcedimentosIa(obj.procedimentos);
  const cuidados = unique((obj.cuidados || []).map((c) => semPreco(typeof c === "string" ? c : c?.texto)));
  const tempo = semPreco(obj.tempo_estimado);
  const parts = [];
  if (procs.length) parts.push(procs.join(", "));
  if (cuidados.length) parts.push("Cuidados: " + cuidados.slice(0, 4).join("; "));
  if (tempo) parts.push("Tempo: " + tempo);
  return parts.join("\n").trim();
}

export function payloadProtocoloIaFicha({ anamnese = [], analises = [], planos = [] } = {}) {
  const anam = (anamnese || [])
    .map((r) => nome(r?.conteudo || r?.texto).slice(0, 280))
    .filter(Boolean)
    .slice(0, 2);
  const pele = (analises || [])
    .map((a) => nome(a?.texto_validado))
    .filter(Boolean)
    .slice(0, 1);
  const plano = unique((planos || []).map((p) => p?.nome || p?.name)).slice(0, 3);
  return {
    analise: {
      anamnese: anam,
      pele_validada: pele,
    },
    dados: {
      plano: plano.join(", "),
    },
  };
}

export function temFonteParaIa(payload) {
  const a = payload?.analise || {};
  return (a.anamnese && a.anamnese.length > 0) || (a.pele_validada && a.pele_validada.length > 0);
}

/** Texto ao lado da sugestão. Nunca cita ia_preliminar. */
export function rotuloFonteIa(payload) {
  const a = payload?.analise || {};
  const bits = [];
  if (a.anamnese?.length) bits.push("anamnese");
  if (a.pele_validada?.length) bits.push("avaliação validada");
  if (!bits.length) return "Sem fonte validada nesta ficha.";
  return `Usa ${bits.join(" e ")}. Sem rascunho preliminar.`;
}
