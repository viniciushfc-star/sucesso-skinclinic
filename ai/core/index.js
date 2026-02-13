/**
 * Camada oficial e obrigatória de acesso à IA.
 * Nenhuma chamada ao modelo pode acontecer fora deste módulo.
 *
 * Fluxo askAI: canCallAI → summarizeContext → cache → enforceBudget → selectModel
 *             → enforceTokenLimit → execute → logAICost → return
 */

import { chat } from "../../lib/openai-client.js";
import { canCallAI, tryDeterministicAnswer } from "./decision.js";
import { summarizeContext } from "./summarizer.js";
import { selectModel, COMPLEXITY } from "./models.js";
import { enforceTokenLimit } from "./limits.js";
import { enforceBudget, getUserBudgetStatus } from "./budget.js";
import { cacheOrExecute } from "./cache.js";
import { logAICost } from "./cost.js";

export { canCallAI, tryDeterministicAnswer } from "./decision.js";
export { summarizeContext, summarizeTransactionsContext, summarizeClientsContext, summarizeAgendaContext, summarizeGenericContext } from "./summarizer.js";
export { selectModel, COMPLEXITY } from "./models.js";
export { enforceTokenLimit, MAX_TOKENS } from "./limits.js";
export { getUserBudgetStatus, enforceBudget, getCurrentMonthCostUsd, checkBudget } from "./budget.js";
export { cacheOrExecute, cacheGet, cacheSet } from "./cache.js";
export { logAICost, estimateCostUsd } from "./cost.js";

/**
 * @typedef {object} AskAIOptions
 * @property {string} [userId]
 * @property {string} [orgId]
 * @property {string} feature - Ex.: "copiloto", "preco", "marketing"
 * @property {string} question - Pergunta ou prompt (pode incluir contexto já formatado)
 * @property {object} [rawContext] - Dados brutos a serem resumidos (nunca enviar listas grandes)
 * @property {"simple"|"medium"|"rare"} [complexity]
 * @property {object} [checks] - Para canCallAI: { sqlResolve, regraResolve, estatisticaResolve, templateResolve }
 * @property {"short"|"analysis"} [outputType]
 * @property {string} [systemInstruction]
 * @property {boolean} [skipCache]
 * @property {number} [cacheTtlMs]
 * @property {object} [summarizeOpts] - Opções para summarizeContext (schema, topN, maxItemsRaw)
 * @property {Array<{role: string, content: string|array}>} [messages] - Se informado, usa em vez de question (multimodal)
 * @property {object} [extraCreateOptions] - Ex.: response_format, max_tokens
 */

/**
 * Único ponto de entrada para chamadas ao modelo.
 * Fluxo: 1) canCallAI 2) summarize 3) cache 4) budget 5) model 6) limit 7) execute 8) log 9) return
 *
 * @param {AskAIOptions} opts
 * @returns {Promise<{ content: string, usage?: object, cached: boolean }>}
 */
export async function askAI(opts) {
  const {
    userId,
    orgId,
    feature = "unknown",
    question = "",
    rawContext = {},
    complexity = COMPLEXITY.MEDIUM,
    checks = {},
    outputType = "analysis",
    systemInstruction = "",
    skipCache = false,
    cacheTtlMs = 5 * 60 * 1000,
    summarizeOpts = {},
    messages: customMessages,
    extraCreateOptions = {},
  } = opts;

  // 1) Pirâmide de decisão
  if (!canCallAI(checks)) {
    throw new Error("IA não necessária: resolver via backend (SQL, regra, estatística ou template).");
  }

  // 2) Redução de contexto
  const summarized = Object.keys(rawContext).length > 0
    ? summarizeContext(rawContext, summarizeOpts)
    : null;
  const contextStr = summarized ? JSON.stringify(summarized) : "";
  const prompt = question + (contextStr ? `\n\nContexto (resumido):\n${contextStr}` : "");

  // 3) Orçamento
  const budget = enforceBudget(userId);
  if (!budget.allow) {
    throw new Error(budget.message || "Orçamento de IA esgotado.");
  }
  const useCheapest = budget.useCheapestModel === true;
  const effectiveComplexity = useCheapest ? COMPLEXITY.SIMPLE : complexity;

  // 4) Modelo e limite
  selectModel(effectiveComplexity);
  const maxTokensOverride = budget.reduceTokens ? 150 : undefined;
  const maxTokens = enforceTokenLimit(effectiveComplexity, outputType, {
    override: maxTokensOverride,
    justification: budget.reduceTokens ? "alerta" : undefined,
  });

  const finalMessages = customMessages && customMessages.length > 0
    ? customMessages
    : [{ role: "user", content: prompt }];

  const cacheKey = skipCache || cacheTtlMs <= 0
    ? null
    : { feature, prompt: prompt.slice(0, 2000), complexity: effectiveComplexity, outputType };

  const modelName = selectModel(effectiveComplexity);
  const execute = async () => {
    return chat(finalMessages, {
      feature,
      userId,
      orgId,
      outputType,
      complexity: effectiveComplexity,
      systemInstruction,
      cacheTtlMs: 0,
      skipCache: true,
      skipLog: true,
      extraCreateOptions: {
        ...extraCreateOptions,
        max_tokens: extraCreateOptions.max_tokens ?? maxTokens,
      },
    });
  };

  let result;
  if (cacheKey && cacheTtlMs > 0) {
    result = await cacheOrExecute(cacheKey, execute, cacheTtlMs);
  } else {
    result = await execute();
  }

  // 8) Log obrigatório (único ponto de registro para dashboards)
  if (result.usage && (userId || orgId)) {
    logAICost({
      userId,
      orgId,
      feature,
      model: modelName,
      promptTokens: result.usage.prompt_tokens ?? 0,
      completionTokens: result.usage.completion_tokens ?? 0,
    });
  }
  return result;
}

