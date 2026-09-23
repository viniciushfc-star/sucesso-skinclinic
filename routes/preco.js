import { askAI, summarizeGenericContext, COMPLEXITY } from "../ai/core/index.js";
import { requireStaffAccess, sendAuthError } from "../lib/api-auth.js";

function mercadoUsavel(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const ticket = Number(raw.ticket || raw.ticketMedio);
  const concorrencia = String(raw.concorrencia || "").trim();
  if (!(Number.isFinite(ticket) && ticket > 0) || concorrencia.length < 3) return null;
  return { ticket, concorrencia: concorrencia.slice(0, 200) };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let auth;
  try {
    auth = await requireStaffAccess(req, { permission: "ia:assist" });
  } catch (e) {
    return sendAuthError(res, e);
  }
  const { user, orgId } = auth;

  const { custos, protocolo, mercado } = req.body || {};

  const custosArr = Array.isArray(custos) ? custos : [];
  const resumoCustos = summarizeGenericContext(custosArr, "valor", 5);
  const mercadoOk = mercadoUsavel(mercado);
  const payload = {
    custos: custosArr.length > 10 ? resumoCustos : custos,
    protocolo: protocolo || {},
    mercado: mercadoOk,
  };

  const blocoMercado = mercadoOk
    ? `Referência de mercado informada pela clínica (não inventar concorrente):\n${JSON.stringify(payload.mercado)}`
    : "Sem dados de mercado. Não invente preço de concorrente nem chame o resultado de preço de mercado. Calcule só pela estrutura de custos.";

  const prompt = `
Custos da clínica (resumo quando muitos itens):
${JSON.stringify(payload.custos)}

Protocolo:
${JSON.stringify(payload.protocolo)}

${blocoMercado}

Gere: preço mínimo viável, preço calculado pela estrutura de custos (não mercado), margem, sugestão de parcelamento, justificativa.
Não altere o preço da clínica. Não afirme que o valor é o de mercado.
Retorne APENAS um JSON válido, sem markdown:
{ "preco_min": 0, "preco_calculado": 0, "margem": 0, "parcelamento": "", "justificativa": "" }
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
      systemInstruction:
        "Você apoia gestão de clínica. Retorne somente o JSON. Sem diagnóstico. Sem preço de mercado inventado. Sem mudar o preço cobrado.",
      extraCreateOptions: { response_format: { type: "json_object" } },
    });
    const message = { content: content || "{}", role: "assistant" };
    res.json(message);
  } catch (err) {
    console.error("[PRECO]", err);
    res.status(500).json({ content: "", role: "assistant", error: "Erro interno" });
  }
}

