import { getApiBase } from "../core/api-base.js";

/**
 * Pergunta ao Copilot (IA contextual da clínica).
 * @param {Object} payload
 * @param {string} payload.pergunta - Pergunta do usuário
 * @param {string} payload.user_id - ID do usuário
 * @param {Object} [payload.contextoNotificacao] - Contexto opcional da notificação que originou a pergunta
 * @param {string} [payload.contextoNotificacao.titulo] - Título da notificação
 * @param {string} [payload.contextoNotificacao.mensagem] - Mensagem da notificação
 */
export async function perguntarCopiloto(payload) {
  try {
    const r = await fetch(`${getApiBase()}/api/copiloto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      console.warn("[COPILOTO_API] Resposta não é JSON (status " + r.status + "). API do Copilot pode não estar configurada.");
      return {
        resposta: "O Copilot não está disponível neste ambiente. Em produção, configure a rota /api/copiloto (e variáveis OPENAI_KEY, Supabase) para usar a IA.",
      };
    }
    const data = await r.json();
    if (!r.ok) {
      return { resposta: data?.message || "Erro ao consultar o Copilot. Tente novamente." };
    }
    return data;
  } catch (err) {
    console.error("[COPILOTO_API]", err);
    return {
      resposta: "Não foi possível conectar ao Copilot. Verifique se a API está rodando (em desenvolvimento a rota /api/copiloto pode retornar 404).",
    };
  }
}
