import { askAI, COMPLEXITY } from "./ai/core/index.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { caso, user_id, org_id } = req.body || {};
  const textoCaso = typeof caso === "string" ? caso : (caso ? JSON.stringify(caso) : "");

  if (!textoCaso || !textoCaso.trim()) {
    return res.status(400).json({ error: "Descreva o caso para pedir opinião." });
  }

  const prompt = `Você é IA especialista em estética/dermatologia, para APOIAR o profissional, não substituí-lo.

Caso descrito:
---
${textoCaso}
---

Responda em markdown, direto e em bullets:
## 1. Discussão do caso
- Raciocínio clínico (sem diagnosticar nem prescrever), possíveis abordagens, diferenciais.

## 2. Procedimentos que podem se alinhar
- Liste procedimentos considerados nesse tipo de caso; para cada um: quando faz sentido, o que esperar, cuidado. Decisão final é do profissional.

## 3. Artigos e referências
- Temas de estudo e links úteis em markdown (SBD, CBR, PubMed, Scholar).`;

  try {
    const { content } = await askAI({
      userId: user_id,
      orgId: org_id,
      feature: "discussao-caso",
      question: prompt,
      complexity: COMPLEXITY.MEDIUM,
      checks: {},
      outputType: "analysis",
      systemInstruction: "Seja didático e claro. Objetivo é o profissional se preparar com evidência.",
      cacheTtlMs: 5 * 60 * 1000,
    });
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ content: content ?? "", role: "assistant" });
  } catch (err) {
    console.error("[discussao-caso]", err);
    res.status(500).json({ error: err.message || "Erro ao pedir opinião da IA." });
  }
}
