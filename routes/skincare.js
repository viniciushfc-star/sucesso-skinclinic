import { askAI, COMPLEXITY } from "../ai/core/index.js";
import { requireStaffAccess, sendAuthError } from "../lib/api-auth.js";
import { payloadMarcasParaIa } from "../js/utils/marcas-casa.js";
import { fraseIaDestaque, payloadDestaquesParaIa } from "../js/utils/skincare-mercado.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let auth;
  try {
    auth = await requireStaffAccess(req, { permission: "ia:assist" });
  } catch (e) {
    return sendAuthError(res, e);
  }
  const { user, orgId } = auth;

  const { analise, protocolo, marcas_casa, destaques_mercado } = req.body || {};
  const casa = payloadMarcasParaIa(marcas_casa);
  const destaques = payloadDestaquesParaIa(destaques_mercado);
  const blocoCasa = casa.marcas.length
    ? `MARCAS E PRODUTOS DA CASA (prioridade da rotina; nomes permitidos para prescrever no rascunho):\n${JSON.stringify(casa)}`
    : "Sem marcas da casa selecionadas. Descreva os passos (limpeza, hidratação etc.) SEM citar marca de mercado, concorrente ou ranking.";
  const blocoDestaque = destaques.length
    ? `DESTAQUES CITADOS PELA CLÍNICA (só com fonte; NÃO substituem a casa; NÃO são ranking):\n${JSON.stringify(destaques)}\n${fraseIaDestaque()}`
    : "Sem destaque com fonte. NÃO invente o que o mercado destaca.";

  const prompt = `
Com base na análise:
${JSON.stringify(analise || {})}

E protocolo:
${JSON.stringify(protocolo || {})}

${blocoCasa}

${blocoDestaque}

Crie um RASCUNHO de skincare domiciliar para o profissional revisar: rotina manhã, rotina noite, cuidados semanais, alertas, e evidencias (destaques citados, se houver).
A rotina (manha/noite/semanal) usa SOMENTE produtos/marcas da casa listados, se houver. Destaques vão só em "evidencias", com fonte. NÃO invente concorrente. NÃO diga "o melhor do mercado". NÃO prescreva medicamentos. NÃO trate isto como plano liberado ao cliente.
Retorne APENAS um JSON válido, sem markdown:
{ "manha": [], "noite": [], "semanal": [], "alertas": [], "evidencias": [], "status": "rascunho" }
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
      systemInstruction:
        "Você gera rascunho para o profissional validar. Rotina = marcas da casa. Destaque só com fonte citada, nunca ranking. Não libera ao cliente. Retorne somente o JSON.",
      extraCreateOptions: { response_format: { type: "json_object" } },
    });
    res.json({ content: content || "{}", role: "assistant" });
  } catch (err) {
    console.error("[SKINCARE]", err);
    res.status(500).json({ content: "{}", role: "assistant", error: "Erro interno" });
  }
}

