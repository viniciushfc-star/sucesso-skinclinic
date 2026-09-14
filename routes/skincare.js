import { askAI, COMPLEXITY } from "../ai/core/index.js";
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

  const { analise, protocolo } = req.body || {};

  const prompt = `
Com base na análise:
${JSON.stringify(analise || {})}

E protocolo:
${JSON.stringify(protocolo || {})}

Crie um RASCUNHO de skincare domiciliar para o profissional revisar: rotina manhã, rotina noite, cuidados semanais, alertas. NÃO prescreva medicamentos. NÃO trate isto como plano liberado ao cliente.
Retorne APENAS um JSON válido, sem markdown:
{ "manha": [], "noite": [], "semanal": [], "alertas": [], "status": "rascunho" }
`;

  try {
    const { content } = await askAI({
      userId: user.id,
      orgId,
      feature: "skincare",
      question: prompt,
      complexity: COMPLEXITY.MEDIUM,
      checks: {},
      outputType: "analysis",
      systemInstruction: "Você gera rascunho para o profissional validar. Não libera conteúdo ao cliente. Retorne somente o JSON solicitado.",
      extraCreateOptions: { response_format: { type: "json_object" } },
    });
    res.json({ content: content || "{}", role: "assistant" });
  } catch (err) {
    console.error("[SKINCARE]", err);
    res.status(500).json({ content: "{}", role: "assistant", error: "Erro interno" });
  }
}

