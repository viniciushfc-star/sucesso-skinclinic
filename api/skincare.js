import { askAI, COMPLEXITY } from "./ai/core/index.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { analise, protocolo, user_id, org_id } = req.body || {};

  const prompt = `
Com base na análise:
${JSON.stringify(analise || {})}

E protocolo:
${JSON.stringify(protocolo || {})}

Crie um plano de skincare domiciliar: rotina manhã, rotina noite, cuidados semanais, alertas. NÃO prescreva medicamentos.
Retorne APENAS um JSON válido, sem markdown:
{ "manha": [], "noite": [], "semanal": [], "alertas": [] }
`;

  try {
    const { content } = await askAI({
      userId: user_id,
      orgId: org_id,
      feature: "skincare",
      question: prompt,
      complexity: COMPLEXITY.MEDIUM,
      checks: {},
      outputType: "analysis",
      systemInstruction: "Você é especialista em estética. Retorne somente o JSON solicitado.",
      extraCreateOptions: { response_format: { type: "json_object" } },
    });
    res.json({ content: content || "{}", role: "assistant" });
  } catch (err) {
    console.error("[SKINCARE]", err);
    res.status(500).json({ content: "{}", role: "assistant", error: err.message });
  }
}
