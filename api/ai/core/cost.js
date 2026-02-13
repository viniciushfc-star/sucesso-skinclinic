/**
 * Registro obrigatório de custo por requisição.
 * Sem log → consideramos erro de implementação (askAI sempre chama logAICost).
 */

import { logUsage } from "../../lib/openai-cost.js";
import { PRICE_PER_1K } from "../../lib/openai-config.js";

/**
 * Registra custo da chamada de IA. Obrigatório após toda execução.
 * @param {object} record
 * @param {string} [record.userId]
 * @param {string} [record.orgId]
 * @param {string} record.feature
 * @param {string} record.model
 * @param {number} record.promptTokens
 * @param {number} record.completionTokens
 * @returns {number} Custo estimado em USD
 */
export function logAICost(record) {
  if (!record || !record.feature || !record.model) {
    console.error("[AI_COST] logAICost chamado sem feature/model. Registro ignorado.", record);
  }
  return logUsage({
    userId: record.userId,
    orgId: record.orgId,
    feature: record.feature,
    model: record.model,
    promptTokens: record.promptTokens ?? 0,
    completionTokens: record.completionTokens ?? 0,
  });
}

/**
 * Estima custo em USD para um modelo e tokens.
 */
export function estimateCostUsd(model, promptTokens, completionTokens) {
  const prices = PRICE_PER_1K[model];
  if (!prices) return 0;
  return (
    (promptTokens / 1000) * prices.input +
    (completionTokens / 1000) * prices.output
  );
}
