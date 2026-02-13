import vision from "@google-cloud/vision";
import { askAI, COMPLEXITY } from "./ai/core/index.js";

const client = new vision.ImageAnnotatorClient({
  keyFilename: "google-key.json",
});

/**
 * OCR: imagem ou texto. Extrai dados estruturados (produto, qtd, valor, fornecedor, data).
 * Canon: OCR sugere, não decide; campos editáveis.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { imageBase64, parseOnly } = req.body;

  let text = "";
  if (imageBase64 && !parseOnly) {
    try {
      const [result] = await client.textDetection({
        image: { content: imageBase64 },
      });
      text = result.fullTextAnnotation?.text ?? "";
    } catch (err) {
      console.error("[OCR] Vision", err);
      return res.status(500).json({ error: "Erro ao ler imagem.", text: "" });
    }
  } else if (req.body.text && parseOnly) {
    text = req.body.text;
  } else if (!imageBase64 && !req.body.text) {
    return res.status(400).json({ error: "Envie imageBase64 ou text (com parseOnly)." });
  }

  let parsed = null;
  if (text) {
    try {
      const systemInstruction = `Extraia dados de nota fiscal / compra. Retorne APENAS um JSON válido, sem markdown:
{ "fornecedor": "nome ou null", "data": "YYYY-MM-DD ou null", "itens": [ { "produto_nome": "string", "quantidade": number, "valor_unitario": number ou null, "valor_total": number ou null, "lote": "string ou null" } ] }
Use null quando não conseguir identificar. Quantidades e valores em números.`;
      const { content } = await askAI({
        feature: "ocr",
        question: text.slice(0, 8000),
        complexity: COMPLEXITY.SIMPLE,
        checks: {},
        outputType: "short",
        systemInstruction,
        cacheTtlMs: 0,
        extraCreateOptions: { response_format: { type: "json_object" } },
      });
      if (content) parsed = JSON.parse(content);
    } catch (e) {
      console.warn("[OCR] Parse", e);
    }
  }

  res.json({ text, parsed });
}
