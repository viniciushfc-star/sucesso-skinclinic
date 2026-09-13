import { askAI, summarizeGenericContext, COMPLEXITY } from "../ai/core/index.js";
import { requireStaffAccess, sendAuthError } from "../lib/api-auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let auth;
  try {
    auth = await requireStaffAccess(req, { permission: "dashboard:view" });
  } catch (e) {
    return sendAuthError(res, e);
  }
  const { user, orgId } = auth;

  const { custos, protocolo, mercado } = req.body || {};

  const custosArr = Array.isArray(custos) ? custos : [];
  const resumoCustos = summarizeGeneric(custosArr, "valor", 5);
  const payload = {
    custos: custosArr.length > 10 ? resumoCustos : custos,
    protocolo: protocolo || {},
    mercado: mercado || {},
  };

  const prompt = `
Custos da clínica (resumo quando muitos itens):
${JSON.stringify(payload.custos)}

Protocolo:
${JSON.stringify(payload.protocolo)}

Mercado:
${JSON.stringify(payload.mercado)}

Gere: preço mínimo viável, preço ideal, margem, sugestão de parcelamento, justificativa.
Retorne APENAS um JSON válido, sem markdown:
{ "preco_min": 0, "preco_ideal": 0, "margem": 0, "parcelamento": "", "justificativa": "" }
`;

  try {
    const { content } = await askAI({
      userId: user.id,
      orgId,
      feature: "preco",
      question: prompt,
      complexity: COMPLEXITY.MEDIUM,
      checks: {},
      outputType: "analysis",
      systemInstruction: "Você é especialista em gestão de clínicas. Retorne somente o JSON solicitado.",
      extraCreateOptions: { response_format: { type: "json_object" } },
    });
    const message = { content: content || "{}", role: "assistant" };
    res.json(message);
  } catch (err) {
    console.error("[PRECO]", err);
    res.status(500).json({ content: "", role: "assistant", error: err.message });
  }
}

