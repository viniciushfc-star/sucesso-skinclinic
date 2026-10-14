import { askAI, COMPLEXITY } from "../ai/core/index.js";
import { requireStaffAccess, sendAuthError } from "../lib/api-auth.js";
import { SISTEMA_ESTUDO_CASO, promptEstudoCasoEsclarecer } from "../js/utils/estudo-caso-ia.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let auth;
  try {
    auth = await requireStaffAccess(req, { permission: "ia:assist" });
  } catch (e) {
    return sendAuthError(res, e);
  }
  const { user, orgId } = auth;

  const { texto_artigo_ou_tema, duvida } = req.body || {};
  const duvidaText = typeof duvida === "string" ? duvida.trim() : "";
  if (!duvidaText) {
    return res.status(400).json({ error: "Descreva sua dúvida." });
  }

  const tema = typeof texto_artigo_ou_tema === "string" && texto_artigo_ou_tema.trim() ? texto_artigo_ou_tema.trim() : null;

  const prompt = promptEstudoCasoEsclarecer({ tema, duvida: duvidaText });

  try {
    const { content: resposta } = await askAI({
      userId: user.id,
      orgId,
      feature: "estudo-caso-esclarecer",
      question: prompt,
      complexity: COMPLEXITY.SIMPLE,
      checks: {},
      outputType: "short",
      systemInstruction: SISTEMA_ESTUDO_CASO,
      cacheTtlMs: 30 * 60 * 1000,
    });
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ resposta: resposta ?? "", role: "assistant" });
  } catch (err) {
    console.error("[estudo-caso-esclarecer]", err);
    res.status(500).json({ error: "Erro interno" });
  }
}

