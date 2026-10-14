/**
 * Origem do produto: estoque da clínica vs representação de marca.
 * Não muda preço. Representação não entra no capital da casa.
 */

export const POSSE_CLINICA = "clinica";
export const POSSE_REPRESENTACAO = "representacao";

export function normalizePosse(raw) {
  const s = String(raw || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (s === "representacao" || s === "rep" || s === "marca") return POSSE_REPRESENTACAO;
  return POSSE_CLINICA;
}

export function labelPosse(raw) {
  return normalizePosse(raw) === POSSE_REPRESENTACAO ? "Representação" : "Da clínica";
}

export function eRepresentacao(raw) {
  return normalizePosse(raw) === POSSE_REPRESENTACAO;
}

export function marcaRepresentada(raw) {
  const t = String(raw || "").trim();
  return t || null;
}
