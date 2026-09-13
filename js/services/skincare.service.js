import { apiFetch } from "../core/api-fetch.js";

/**
 * Gera análise de skincare via IA
 * NÃO salva nada
 */
export async function gerarSkincare(payload){
  if (!payload) throw new Error("Payload inválido");

  const response = await apiFetch("/api/skincare-ai", {
    method: "POST",
    json: payload,
  });

  if (!response.ok) throw new Error("Erro na IA");

  return await response.json();
}
