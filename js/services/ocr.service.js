import { getApiBase } from "../core/api-base.js";

/**
 * OCR: imagem → texto e (opcional) parse estruturado (produto, qtd, valor, fornecedor, data).
 * Canon: OCR sugere, não decide; campos editáveis.
 */
export async function lerNota(base64) {
  const res = await fetch(`${getApiBase()}/api/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64 })
  })
  return res.json()
}

/** Apenas parse de texto já lido (retorna { text, parsed }). */
export async function parseTextoNota(texto) {
  const res = await fetch(`${getApiBase()}/api/ocr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: texto, parseOnly: true })
  })
  return res.json()
}
