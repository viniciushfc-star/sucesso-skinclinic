import { createClient } from "@supabase/supabase-js";
import { askAI, COMPLEXITY } from "../ai/core/index.js";
import { requireStaffAccess, sendAuthError } from "../lib/api-auth.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let auth;
  try {
    auth = await requireStaffAccess(req, { permission: "dashboard:view" });
  } catch (e) {
    return sendAuthError(res, e);
  }
  const { user, orgId } = auth;

  const { nicho, cidade, ticket, procedimentos } = req.body || {};
  const dados = { nicho, cidade, ticket, procedimentos };

  let contextoReal = "";
  if (orgId) {
    try {
      const [orgRes, planosRes, proceduresRes, agendaRes] = await Promise.all([
        supabase.from("organizations").select("name,cidade,estado").eq("id", orgId).single(),
        supabase.from("planos").select("id,name,price_range,active").eq("org_id", orgId).limit(20),
        supabase.from("procedures").select("id,name,duration_minutes").eq("org_id", orgId).limit(30),
        supabase.from("agenda").select("id,data").eq("org_id", orgId).gte("data", new Date().toISOString().slice(0, 10)).limit(100),
      ]);
      const org = orgRes.data || {};
      const planos = (planosRes.data || []).slice(0, 5);
      const procedures = (proceduresRes.data || []).slice(0, 10);
      const agendaCount = (agendaRes.data || []).length;
      const regiao = [org.cidade, org.estado].filter(Boolean).join(", ") || "não informada";
      contextoReal = `
DADOS REAIS DA CLÍNICA (resumo):
- Nome: ${org.name || "—"}
- Região: ${regiao}
- Planos (top 5): ${JSON.stringify(planos)}
- Procedimentos (top 10): ${JSON.stringify(procedures)}
- Próximos agendamentos (volume): ${agendaCount}
Use para alinhar sugestões à região e capacidade.
`;
    } catch (_) {
      contextoReal = "\n(Dados da clínica não disponíveis.)\n";
    }
  }

  const prompt = `
Copilot de Marketing — estratégico, não agência. NÃO decide campanhas nem orçamento. NUNCA invente personas genéricas. Tom: educativo, claro.

DADOS INFORMADOS:
${JSON.stringify(dados)}
${contextoReal}

Gere em texto (não JSON), em português, direto e em bullets:
1. Entendimento de público (a partir dos dados)
2. Ideias de conteúdo (temas, formatos)
3. Métricas de tráfego pago: CPL, CPA, ROAS em linguagem simples; como aplicar
4. Horários de postagem (sugestão breve)
5. O que NÃO fazer
Mantenha útil e curto. Não decida nada pelo gestor.
`;

  try {
    const { content } = await askAI({
      userId: user.id,
      orgId,
      feature: "marketing",
      question: prompt,
      complexity: COMPLEXITY.MEDIUM,
      checks: {},
      outputType: "analysis",
      systemInstruction: "Seja direto, use bullets. Marketing bom atrai o cliente certo no momento certo.",
      cacheTtlMs: 5 * 60 * 1000,
    });
    res.json({ content: content || "", role: "assistant" });
  } catch (err) {
    console.error("[MARKETING]", err);
    res.status(500).json({ error: "Erro ao gerar sugestões de marketing.", content: "" });
  }
}

