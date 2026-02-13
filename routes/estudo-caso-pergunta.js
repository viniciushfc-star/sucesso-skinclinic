import { askAI, COMPLEXITY } from "../ai/core/index.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { caso_resumo, pergunta, artigo_contexto, tipo, user_id, org_id } = req.body || {};
  const perguntaText = typeof pergunta === "string" ? pergunta.trim() : "";
  if (!perguntaText) {
    return res.status(400).json({ error: "Envie sua pergunta." });
  }

  const isEsclarecer = tipo === "esclarecer";
  const contextoArtigo = typeof artigo_contexto === "string" && artigo_contexto.trim() ? artigo_contexto.trim() : null;

  let userContent = "";
  if (isEsclarecer) {
    userContent = `O profissional leu um artigo ou tema e quer esclarecer uma dúvida.
${contextoArtigo ? `Contexto / artigo:\n${contextoArtigo}\n\n` : ""}
Dúvida:\n${perguntaText}
Responda em markdown, didático. Sugira busca (PubMed, Google Scholar) se fizer sentido.`;
  } else {
    const resumo = caso_resumo && typeof caso_resumo === "object"
      ? `Tipo de pele: ${caso_resumo.tipo_pele || "—"}\nQueixa: ${caso_resumo.queixa_principal || "—"}\nResposta observada: ${caso_resumo.resposta_observada || "—"}\nSessões: ${caso_resumo.n_sessoes ?? "—"}\nObservação: ${caso_resumo.observacao || "—"}`
      : "Caso não detalhado.";
    userContent = `Profissional estudando caso (anonimizado). Resumo do caso:\n---\n${resumo}\n---\n\nPergunta:\n---\n${perguntaText}\n---\nResponda em markdown: didático, relacione com o caso, sugira artigos/termos de busca (PubMed, Scholar) para estudar.`;
  }

  const systemInstruction = `Você é IA especialista em estética/dermatologia, para APOIAR o profissional a aprender. NÃO substitui julgamento clínico. Seja didático e claro.`;

  try {
    const { content: resposta_ia } = await askAI({
      userId: user_id,
      orgId: org_id,
      feature: "estudo-caso-pergunta",
      question: userContent,
      complexity: COMPLEXITY.MEDIUM,
      checks: {},
      outputType: "analysis",
      systemInstruction,
      cacheTtlMs: 5 * 60 * 1000,
    });
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ resposta_ia: resposta_ia ?? "", role: "assistant" });
  } catch (err) {
    console.error("[estudo-caso-pergunta]", err);
    res.status(500).json({ error: err.message || "Erro ao processar pergunta." });
  }
}

