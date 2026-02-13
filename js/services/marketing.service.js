import { getApiBase } from "../core/api-base.js";

/**
 * Copilot de Marketing — sugere conteúdo, foco, métricas e timing.
 * Alinhado ao canon: não decide orçamento, não posta sem permissão, respeita operação.
 */
export async function gerarMarketing(payload) {
  return fetch(`${getApiBase()}/api/marketing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(r => r.json())
}
