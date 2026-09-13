import { apiFetch } from "../core/api-fetch.js";

/**
 * OCR: imagem → texto e (opcional) parse estruturado.
 */
export async function lerNota(base64) {
  const res = await apiFetch("/api/ocr", {
    method: "POST",
    json: { imageBase64: base64 },
  });
  return res.json();
}

export async function parseTextoNota(texto) {
  const res = await apiFetch("/api/ocr", {
    method: "POST",
    json: { text: texto, parseOnly: true },
  });
  return res.json();
}
