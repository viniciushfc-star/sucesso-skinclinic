import { askAI, COMPLEXITY } from "../ai/core/index.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { analise, dados, user_id, org_id } = req.body || {};

  const prompt = `
Com base na análise:
${JSON.stringify(analise || {})}

E dados do cliente:
${JSON.stringify(dados || {})}

Crie um protocolo clínico: procedimentos, quantidade de sessões, intervalo, duração, cuidados pré e pós, tempo estimado. NÃO prescreva medicamentos.
Retorne APENAS um JSON válido, sem markdown:
{ "procedimentos": [], "cronograma": [], "cuidados": [], "tempo_estimado": "" }
`;

  try {
    const { content } = await askAI({
      userId: user_id,
      orgId: org_id,
      feature: "protocolo",
      question: prompt,
      complexity: COMPLEXITY.MEDIUM,
      checks: {},
      outputType: "analysis",
      systemInstruction: "Você é especialista em estética. Retorne somente o JSON solicitado.",
      extraCreateOptions: { response_format: { type: "json_object" } },
    });
    res.json({ content: content || "{}", role: "assistant" });
  } catch (err) {
    console.error("[PROTOCOLO]", err);
    res.status(500).json({ content: "{}", role: "assistant", error: err.message });
  }
}

