import { askAI, COMPLEXITY } from "./ai/core/index.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { texto_artigo_ou_tema, duvida, user_id, org_id } = req.body || {};
  const duvidaText = typeof duvida === "string" ? duvida.trim() : "";
  if (!duvidaText) {
    return res.status(400).json({ error: "Descreva sua dúvida." });
  }

  const tema = typeof texto_artigo_ou_tema === "string" && texto_artigo_ou_tema.trim() ? texto_artigo_ou_tema.trim() : null;

  const prompt = `O profissional leu um artigo ou estudou um tema e quer esclarecer para aprender.
${tema ? `Tema ou artigo:\n---\n${tema}\n---\n\n` : ""}
Dúvida:\n---\n${duvidaText}\n---
Responda em markdown, didático. Sugira onde buscar mais (PubMed, Scholar, guideline). Reforce que a aplicação prática é decisão do profissional com o paciente.`;

  try {
    const { content: resposta } = await askAI({
      userId: user_id,
      orgId: org_id,
      feature: "estudo-caso-esclarecer",
      question: prompt,
      complexity: COMPLEXITY.MEDIUM,
      checks: {},
      outputType: "analysis",
      systemInstruction: "Você é IA especialista em estética/dermatologia, para APOIAR o profissional a aprender.",
      cacheTtlMs: 5 * 60 * 1000,
    });
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ resposta: resposta ?? "", role: "assistant" });
  } catch (err) {
    console.error("[estudo-caso-esclarecer]", err);
    res.status(500).json({ error: err.message || "Erro ao esclarecer." });
  }
}
