/**
 * Lib de integração OpenAI — regras de custo e tokens.
 * Use openai-client.js como ponto de entrada.
 */

export { chat, chatSingle, COMPLEXITY, logUsage, checkBudget, getCurrentMonthCostUsd } from "./openai-client.js";
export { summarizeTransactions, summarizeClients, summarizeAgenda, summarizeGeneric } from "./openai-context.js";
export { whenIANeeded, tryDeterministicAnswer, trimHistory } from "./openai-guard.js";
export {
  COMPLEXITY as COMPLEXITY_LEVELS,
  MAX_TOKENS,
  SYSTEM_INSTRUCTION_CONCISE,
  BUDGET_USD_PER_USER_PER_MONTH,
  getModelForComplexity,
  getMaxTokensForComplexity,
} from "./openai-config.js";
export { get as cacheGet, set as cacheSet, clear as cacheClear } from "./openai-cache.js";
