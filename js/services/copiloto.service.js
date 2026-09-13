import { apiFetch } from "../core/api-fetch.js";

/**
 * Pergunta ao Copilot (IA contextual da clínica).
 */
export async function perguntarCopiloto(payload) {
  try {
    const r = await apiFetch("/api/copiloto", {
      method: "POST",
      json: payload,
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
      return { resposta: data?.error || data?.message || "Erro ao consultar o Copilot. Tente novamente." };
    }
    return data;
  } catch (err) {
    console.error("[COPILOTO_API]", err);
    return {
      resposta: "Não foi possível conectar ao Copilot. Verifique se a API está rodando (em desenvolvimento a rota /api/copiloto pode retornar 404).",
    };
  }
}
