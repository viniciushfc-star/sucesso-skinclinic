import { askAI, COMPLEXITY } from "../ai/core/index.js";
import { requireStaffAccess, sendAuthError } from "../lib/api-auth.js";
import { SISTEMA_ESTUDO_CASO, promptEstudoCasoPergunta } from "../js/utils/estudo-caso-ia.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let auth;
  try {
    auth = await requireStaffAccess(req, { permission: "ia:assist" });
  } catch (e) {
    return sendAuthError(res, e);
  }
  const { user, orgId } = auth;

  const { caso_resumo, pergunta, artigo_contexto, tipo } = req.body || {};
  const perguntaText = typeof pergunta === "string" ? pergunta.trim() : "";
  if (!perguntaText) {
    return res.status(400).json({ error: "Envie sua pergunta." });
  }

  const userContent = promptEstudoCasoPergunta({ caso_resumo, pergunta: perguntaText, artigo_contexto, tipo });

  try {
    const { content: resposta_ia } = await askAI({
      userId: user.id,
      orgId,
      feature: "estudo-caso-pergunta",
      question: userContent,
      complexity: COMPLEXITY.SIMPLE,
      checks: {},
      outputType: "short",
      systemInstruction: SISTEMA_ESTUDO_CASO,
      cacheTtlMs: 30 * 60 * 1000,
    });
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ resposta_ia: resposta_ia ?? "", role: "assistant" });
  } catch (err) {
    console.error("[estudo-caso-pergunta]", err);
    res.status(500).json({ error: "Erro interno" });
  }
}

