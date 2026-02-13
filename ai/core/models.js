/**
 * Roteamento automático de modelo por complexidade.
 * Default sempre o mais barato.
 */

import { COMPLEXITY, getModelForComplexity } from "../../lib/openai-config.js";

export { COMPLEXITY };

/**
 * Seleciona o modelo a ser usado conforme complexidade.
 * @param {"simple"|"medium"|"rare"} complexity
 * @returns {string} Nome do modelo (ex.: gpt-4o-mini, gpt-4o)
 */
export function selectModel(complexity) {
  return getModelForComplexity(complexity || COMPLEXITY.SIMPLE);
}

