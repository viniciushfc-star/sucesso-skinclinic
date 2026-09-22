import { askAI, COMPLEXITY } from "../ai/core/index.js";
import { requireStaffAccess, sendAuthError } from "../lib/api-auth.js";
import { normalizeParsedNota } from "../js/utils/ocr-nota.js";
import { existsSync } from "node:fs";

async function readImageText(imageBase64) {
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || "google-key.json";
  if (!existsSync(keyFile) && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { text: "", visionError: "Vision não configurada. Cole o texto da nota ou use foto com a chave Google." };
  }
  try {
    const vision = (await import("@google-cloud/vision")).default;
    const client = new vision.ImageAnnotatorClient(
      existsSync(keyFile) ? { keyFilename: keyFile } : undefined
    );
    const [result] = await client.textDetection({
      image: { content: imageBase64 },
    });
    return { text: result.fullTextAnnotation?.text ?? "", visionError: null };
  } catch (err) {
    console.error("[OCR] Vision", err);
    return { text: "", visionError: "Não foi possível ler a imagem. Cole o texto da nota." };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let auth;
  try {
    auth = await requireStaffAccess(req, { permission: "ia:assist" });
  } catch (e) {
    return sendAuthError(res, e);
  }

  const { imageBase64, parseOnly } = req.body || {};

  let text = "";
  let visionError = null;
  if (imageBase64 && !parseOnly) {
    const read = await readImageText(imageBase64);
    text = read.text;
    visionError = read.visionError;
  } else if (req.body?.text && parseOnly) {
    text = String(req.body.text || "");
  } else if (!imageBase64 && !req.body?.text) {
    return res.status(400).json({ error: "Envie imageBase64 ou text (com parseOnly)." });
  }

  let parsed = null;
  if (text) {
    try {
      const systemInstruction = `Extraia dados de nota fiscal / compra. Retorne APENAS um JSON válido, sem markdown:
{ "fornecedor": "nome ou null", "data": "YYYY-MM-DD ou null", "itens": [ { "produto_nome": "string", "quantidade": number, "valor_unitario": number ou null, "valor_total": number ou null, "lote": "string ou null" } ] }
Use null quando não conseguir identificar. Quantidades e valores em números. Não invente produto que não esteja no texto.`;
      const { content } = await askAI({
        userId: auth.user.id,
        orgId: auth.orgId,
        feature: "ocr",
        question: text.slice(0, 8000),
        complexity: COMPLEXITY.SIMPLE,
        checks: {},
        outputType: "short",
        systemInstruction,
        cacheTtlMs: 0,
        extraCreateOptions: { response_format: { type: "json_object" } },
      });
      if (content) parsed = normalizeParsedNota(JSON.parse(content));
    } catch (e) {
      console.warn("[OCR] Parse", e);
    }
  }

  res.json({
    text,
    parsed,
    error: !text && visionError ? visionError : undefined,
    visionError: visionError || undefined,
  });
}
