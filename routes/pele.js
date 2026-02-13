import { askAI, COMPLEXITY } from "../ai/core/index.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { imagens, dados, user_id, org_id } = req.body || {};
  const imagensArr = Array.isArray(imagens) ? imagens : [];

  const textPart = `
Analise as imagens e: identifique acne, manchas, flacidez, textura; classifique gravidade (leve, moderado, severo); liste prioridades de tratamento; aponte riscos (fototipo, sensibilidade). NÃO prescreva medicamentos. NÃO faça diagnóstico médico.
Retorne APENAS um JSON válido, sem markdown:
{ "problemas": [], "gravidade": {}, "prioridades": [], "observacoes": [] }

Dados do cliente:
${JSON.stringify(dados || {})}
`;

  const content = [
    { type: "text", text: textPart },
    ...imagensArr.slice(0, 5).map((img) => ({
      type: "image_url",
      image_url: { url: typeof img === "string" && img.startsWith("http") ? img : `data:image/jpeg;base64,${img}` },
    })),
  ];

  try {
    const { content: reply } = await askAI({
      userId: user_id,
      orgId: org_id,
      feature: "pele",
      messages: [{ role: "user", content }],
      complexity: COMPLEXITY.RARE,
      checks: {},
      outputType: "analysis",
      systemInstruction: "Você é especialista em estética facial. Retorne somente o JSON solicitado.",
      skipCache: true,
      extraCreateOptions: { response_format: { type: "json_object" } },
    });
    res.json({ content: reply || "{}", role: "assistant" });
  } catch (err) {
    console.error("[PELE]", err);
    res.status(500).json({ content: "{}", role: "assistant", error: err.message });
  }
}

