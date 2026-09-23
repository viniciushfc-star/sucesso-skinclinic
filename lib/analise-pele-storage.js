/**
 * Paths do bucket privado analise-pele-fotos.
 * Persistimos o path do objeto, nunca URL pública.
 */

export const ANALISE_PELE_BUCKET = "analise-pele-fotos";

const PUBLIC_MARKERS = [
  `/storage/v1/object/public/${ANALISE_PELE_BUCKET}/`,
  `/storage/v1/object/sign/${ANALISE_PELE_BUCKET}/`,
];

/** Converte URL antiga (pública ou signed) em path interno. Path puro permanece. */
export function extractAnalisePeleObjectPath(value) {
  if (value == null) return "";
  let raw = String(value).trim();
  if (!raw) return "";
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      raw = u.pathname + (u.search || "");
    }
  } catch {
    /* valor não é URL absoluta */
  }
  const q = raw.indexOf("?");
  if (q >= 0) raw = raw.slice(0, q);
  for (const marker of PUBLIC_MARKERS) {
    const i = raw.indexOf(marker);
    if (i >= 0) return decodeURIComponent(raw.slice(i + marker.length));
  }
  const encoded = `/object/public/${ANALISE_PELE_BUCKET}/`;
  const j = raw.indexOf(encoded);
  if (j >= 0) return decodeURIComponent(raw.slice(j + encoded.length));
  if (/^https?:\/\//i.test(String(value).trim())) return "";
  return raw.replace(/^\/+/, "");
}

export function isOwnedAnalisePelePath(path, orgId, clientId) {
  const p = extractAnalisePeleObjectPath(path);
  if (!p || !orgId || !clientId) return false;
  const prefix = `${orgId}/${clientId}/`;
  return p.startsWith(prefix) && !p.includes("..");
}

export function collectOwnedAnalisePelePaths(imagens, orgId, clientId) {
  const arr = Array.isArray(imagens) ? imagens : [];
  const out = [];
  for (const item of arr) {
    const p = extractAnalisePeleObjectPath(item);
    if (isOwnedAnalisePelePath(p, orgId, clientId)) out.push(p);
  }
  return out;
}

/** Resposta do portal: nunca inclui ia_preliminar nem fotos. */
export function sanitizePortalAnaliseRow(row) {
  if (!row || typeof row !== "object") return null;
  const status = String(row.status || "");
  const validated = status === "validated" || status === "incorporated";
  return {
    id: row.id,
    status,
    created_at: row.created_at,
    texto_validado: validated && row.texto_validado ? String(row.texto_validado) : null,
  };
}

const PELE_VALIDADA = new Set(["validated", "incorporated"]);

/**
 * Skincare só usa o que o profissional validou.
 * Pendente e ia_preliminar ficam de fora (a IA não gera rotina sozinha).
 */
export function analisesPeleParaSkincare(analises) {
  return (Array.isArray(analises) ? analises : [])
    .filter((a) => PELE_VALIDADA.has(String(a?.status || "")))
    .map((a) => ({
      data: a.created_at,
      texto_validado: a.texto_validado ? String(a.texto_validado) : null,
      status: a.status,
    }));
}

/** Texto que vira anamnese: só a devolutiva humana, nunca o rascunho da IA. */
export function conteudoAnamneseDaAnalise(analise) {
  const t = String(analise?.texto_validado || "").trim();
  if (t) return t;
  return "Análise de pele validada pela clínica. O rascunho da IA permanece só para a equipe.";
}

/** JSON do POST /api/analise-pele para o cliente: sem rascunho interno. */
export function publicSubmitAnaliseBody(json) {
  return {
    id: json?.id ?? null,
    status: json?.status || "aguardando_validacao",
    message: json?.message || "Análise registrada. Um profissional fará a validação.",
  };
}
