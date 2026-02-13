/**
 * Teto padrão de saída. Só pode ser aumentado com justificativa explícita.
 */

import {
  COMPLEXITY,
  MAX_TOKENS,
  getMaxTokensForComplexity,
} from "../../lib/openai-config.js";

const JUSTIFIED_OVERRIDES = new Set([
  "analise_imagem",
  "relatorio_longo_assinado",
]);

/**
 * Aplica limite de tokens de saída.
 * @param {"simple"|"medium"|"rare"} complexity
 * @param {"short"|"analysis"} outputType
 * @param {object} [opts]
 * @param {number} [opts.override] - Aumento só aceito com justificativa
 * @param {string} [opts.justification] - Chave de justificativa (ex.: "analise_imagem")
 * @returns {number} max_tokens a usar
 */
export function enforceTokenLimit(complexity, outputType = "analysis", opts = {}) {
  const base = getMaxTokensForComplexity(
    complexity,
    outputType === "short" ? "SHORT" : "ANALYSIS"
  );
  const { override, justification } = opts || {};
  if (override != null && justification && JUSTIFIED_OVERRIDES.has(justification)) {
    return Math.min(override, MAX_TOKENS.CAP * 2);
  }
  return base;
}

export { MAX_TOKENS };

