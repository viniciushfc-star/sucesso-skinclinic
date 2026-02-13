import { createClient } from "@supabase/supabase-js"
import {
  askAI,
  tryDeterministicAnswer,
  summarizeTransactionsContext,
  summarizeClientsContext,
  summarizeAgendaContext,
  COMPLEXITY,
} from "./ai/core/index.js"

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end()

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("[COPILOTO] SUPABASE_URL ou SUPABASE_SERVICE_KEY ausentes no .env")
    return res.status(200).json({
      resposta: "Supabase não configurado. Preencha SUPABASE_URL e SUPABASE_SERVICE_KEY no .env e reinicie o servidor."
    })
  }

  const { pergunta, user_id, org_id, contextoNotificacao } = req.body || {}
  const perguntaText = (typeof pergunta === "string" ? pergunta : "").trim()
  if (!perguntaText) {
    return res.status(400).json({ resposta: "Envie uma pergunta." })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const filterBy = org_id ? { col: "org_id", val: org_id } : { col: "user_id", val: user_id }
    const qOrg = org_id ? supabase.from("organizations").select("name,cidade,estado").eq("id", org_id).single() : Promise.resolve({ data: null })
    const qClients = supabase.from("clients").select("id,name,phone,email,created_at").limit(100).eq(filterBy.col, filterBy.val)
    const qFinanceiro = supabase.from("financeiro").select("id,descricao,valor,tipo,data,categoria,created_at").order("data", { ascending: false }).limit(100).eq(filterBy.col, filterBy.val)
    const qAgenda = supabase.from("agenda").select("id,data,hora,procedimento,cliente_id,duration_minutes,created_at").order("data", { ascending: true }).limit(100).eq(filterBy.col, filterBy.val)

    const [orgRes, clientesRes, financeiroRes, agendaRes] = await Promise.all([qOrg, qClients, qFinanceiro, qAgenda])
    const orgProfile = orgRes.data || {}
    const clientes = clientesRes.data || []
    const financeiro = financeiroRes.data || []
    const agenda = agendaRes.data || []

    const financeiroResumo = summarizeTransactionsContext(financeiro, 5)
    const clientesResumo = summarizeClientsContext(clientes, 5)
    const agendaResumo = summarizeAgendaContext(agenda, 10)

    const regiao = [orgProfile.cidade, orgProfile.estado].filter(Boolean).join(", ") || ""
    const contexto = `
DADOS DA CLÍNICA (pré-agregados; use apenas o que existir):
- Nome: ${orgProfile.name || "—"}
${regiao ? `- Região: ${regiao}` : ""}

CLIENTES (resumo): total ${clientesResumo.total}; últimos: ${JSON.stringify(clientesResumo.ultimos)}

FINANCEIRO (resumo): total ${financeiroResumo.total}, ${financeiroResumo.count} itens, por tipo ${JSON.stringify(financeiroResumo.byType)}, top 5: ${JSON.stringify(financeiroResumo.top)}

AGENDA (resumo): total ${agendaResumo.total}, por dia ${JSON.stringify(agendaResumo.porDia)}, próximos: ${JSON.stringify(agendaResumo.proximos)}
`

    const deterministic = tryDeterministicAnswer(
      { ...financeiroResumo, count: clientesResumo.total },
      perguntaText.toLowerCase()
    )
    if (deterministic) {
      return res.status(200).json({ resposta: deterministic })
    }

    const ctxNotif = contextoNotificacao?.titulo || contextoNotificacao?.mensagem
      ? `\nCONTEXTO DA NOTIFICAÇÃO:\nTítulo: ${contextoNotificacao.titulo || ""}\nMensagem: ${contextoNotificacao.mensagem || ""}\n`
      : ""

    const systemInstruction = `
Você é o Copilot do Projeto Sucesso — ajuda a pensar, não a decidir.
REGRAS: explique o porquê, mostre relações entre dados; NUNCA tome decisão nem execute ação.
Use APENAS os dados fornecidos. Tom: claro, humano. NUNCA use "Decisão recomendada", "Ação necessária", "Erro crítico".
Formato: "Com base nos dados, isso tende a acontecer por estes motivos…"
${ctxNotif}`

    const question = `DADOS:\n${contexto}\n\nPERGUNTA DO GESTOR:\n"${perguntaText}"\n\nResponda de forma clara e útil. Nunca decida por ele.`
    const { content } = await askAI({
      userId: user_id,
      orgId: org_id,
      feature: "copiloto",
      question,
      complexity: COMPLEXITY.MEDIUM,
      checks: {},
      outputType: "analysis",
      systemInstruction,
      cacheTtlMs: 5 * 60 * 1000,
    })

    res.json({ resposta: content || "Sem resposta." })
  } catch (err) {
    if (err?.message?.includes("OPENAI_KEY")) {
      return res.status(200).json({
        resposta: "A chave da OpenAI não está configurada. Adicione OPENAI_KEY no arquivo .env na pasta do projeto e reinicie o servidor (npm start)."
      })
    }
    if (err?.message?.includes("Orçamento mensal")) {
      return res.status(200).json({ resposta: err.message })
    }

    console.error("[COPILOTO] Erro:", err)
    const raw = err?.message || err?.error?.message || String(err)
    const msg = raw.toLowerCase()
    const status = err?.status ?? err?.statusCode ?? err?.error?.status
    const code = (err?.code ?? err?.error?.code ?? "").toString().toLowerCase()
    const hint = raw.slice(0, 300).replace(/\n/g, " ").trim()
    const detalhe = hint ? `\n\nDetalhe técnico: ${hint}` : ""

    if (status === 401 || msg.includes("incorrect api key") || msg.includes("invalid api key") || msg.includes("authentication")) {
      return res.status(200).json({ resposta: "Chave da OpenAI inválida ou expirada. Verifique OPENAI_KEY no .env em platform.openai.com/api-keys." + detalhe })
    }
    if (code === "insufficient_quota" || msg.includes("insufficient_quota") || msg.includes("you exceeded your current quota")) {
      return res.status(200).json({
        resposta: "Sua conta OpenAI está sem créditos. Adicione forma de pagamento em platform.openai.com → Billing." + detalhe
      })
    }
    if (status === 429 || code === "rate_limit_exceeded" || msg.includes("rate limit exceeded")) {
      return res.status(200).json({
        resposta: "Muitas requisições no momento. Tente em 1–2 minutos." + detalhe
      })
    }
    return res.status(200).json({
      resposta: "Erro ao consultar o Copilot." + (detalhe || " (sem detalhe)")
    })
  }
}
