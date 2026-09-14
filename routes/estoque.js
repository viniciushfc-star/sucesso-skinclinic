import { askAI, summarizeGenericContext, COMPLEXITY } from "../ai/core/index.js";
import { requireStaffAccess, sendAuthError } from "../lib/api-auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let auth;
  try {
    auth = await requireStaffAccess(req, { permission: "ia:assist" });
  } catch (e) {
    return sendAuthError(res, e);
  }
  const { user, orgId } = auth;

  const { estoque, consumo } = req.body || {};

  const estoqueArr = Array.isArray(estoque) ? estoque : [];
  const consumoArr = Array.isArray(consumo) ? consumo : [];
  const resumoEstoque = estoqueArr.length > 15 ? summarizeGeneric(estoqueArr, "quantidade" in estoqueArr[0] ? "quantidade" : "valor", 5) : estoqueArr;
  const resumoConsumo = consumoArr.length > 15 ? summarizeGeneric(consumoArr, "valor" in consumoArr[0] ? "valor" : "quantidade", 5) : consumoArr;

  const prompt = `
Você é especialista em gestão de estoque.

Estoque atual (resumo se muitos itens):
${JSON.stringify(resumoEstoque)}

Consumo médio (resumo se muitos):
${JSON.stringify(resumoConsumo)}

Gere: produtos em risco, quando comprar, quantidade ideal, alertas de validade, prioridade.
Retorne APENAS um JSON válido, sem markdown:
{ "riscos": [], "sugestoes": [], "alertas": [] }
`;

  try {
    const { content } = await askAI({
      userId: user.id,
      orgId,
      feature: "estoque",
      question: prompt,
      complexity: COMPLEXITY.MEDIUM,
      checks: {},
      outputType: "analysis",
      systemInstruction: "Retorne somente o JSON solicitado.",
      extraCreateOptions: { response_format: { type: "json_object" } },
    });
    res.json({ content: content || "{}", role: "assistant" });
  } catch (err) {
    console.error("[ESTOQUE]", err);
    res.status(500).json({ content: "{}", role: "assistant", error: "Erro interno" });
  }
}

