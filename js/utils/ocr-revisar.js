/**
 * OCR do caderno/nota: sempre passa por Revisar. Nada grava sozinho.
 */

import { normalizeParsedNota } from "./ocr-nota.js";

export function rascunhoParaRevisar(parsed, rawText, origem = "ocr") {
  const n = normalizeParsedNota(parsed);
  return {
    status: "revisar",
    origem: origem === "xml" ? "xml" : "ocr",
    fornecedor: n.fornecedor || "",
    data: n.data || "",
    itens: n.itens || [],
    bruto: String(rawText || "").slice(0, 4000),
  };
}

export function podeConfirmarEntrada(itens) {
  if (!Array.isArray(itens)) return false;
  return itens.some((x) => String(x?.produto_nome || "").trim() && Number(x.quantidade) > 0);
}
