import { apiFetch } from "../core/api-fetch.js";

/**
 * Copilot de Marketing — sugere conteúdo, foco, métricas e timing.
 */
export async function gerarMarketing(payload) {
  return apiFetch("/api/marketing", { method: "POST", json: payload }).then((r) => r.json());
}
