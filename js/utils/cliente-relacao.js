/**
 * Relação comercial do cliente com a clínica.
 * Independente do estado clínico (acompanhamento, alta…).
 */

export const RELACAO_COMERCIAL = {
  orcamento: "Só orçamento",
  comprou: "Comprou",
  revenda: "Revenda da clínica",
};

export const RELACAO_KEYS = Object.keys(RELACAO_COMERCIAL);

export function relacaoComercialLabel(key) {
  if (!key) return "Não definido";
  return RELACAO_COMERCIAL[key] || "Não definido";
}

export function normalizeRelacaoComercial(v) {
  const k = String(v || "").trim().toLowerCase();
  if (k === "orcamento" || k === "orçamento") return "orcamento";
  if (k === "comprou" || k === "compra") return "comprou";
  if (k === "revenda" || k === "revendedor" || k === "revendedora") return "revenda";
  return "";
}

/**
 * Interpreta a busca da lista: texto livre + atalho para abrir orçamento / filtrar relação.
 */
export function parseClientesBusca(raw) {
  let rest = String(raw || "").trim();
  const lower = rest.toLowerCase();
  const abrirOrcamento = /\borçamentos?\b|\borcamentos?\b|\bproposta\b/.test(lower);
  let relacao = "";
  if (/\brevenda\b|\brevendedor/.test(lower)) relacao = "revenda";
  else if (/\bcomprou\b/.test(lower)) relacao = "comprou";

  rest = rest
    .replace(/\borçamentos?\b/gi, " ")
    .replace(/\borcamentos?\b/gi, " ")
    .replace(/\bproposta\b/gi, " ")
    .replace(/\brevendedoras?\b/gi, " ")
    .replace(/\brevendedores?\b/gi, " ")
    .replace(/\brevenda\b/gi, " ")
    .replace(/\bcomprou\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (abrirOrcamento && !rest && !relacao) relacao = "";

  return {
    texto: rest,
    relacao,
    abrirOrcamento,
  };
}

/** Não sobrescreve revenda. Orçamento criado só preenche se ainda estiver vazio. Aceite vira comprou. */
export function nextRelacaoComercial(atual, evento) {
  const cur = normalizeRelacaoComercial(atual);
  if (cur === "revenda") return "revenda";
  if (evento === "orcamento_aceito") return "comprou";
  if (evento === "orcamento_criado") return cur || "orcamento";
  return cur || "";
}
