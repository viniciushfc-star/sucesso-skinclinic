/**
 * Wrapper que força as regras de uso da OpenAI:
 * - max_tokens baixo
 * - system instruction para respostas objetivas
 * - modelo por complexidade (custo)
 * - cache por hash do payload
 * - log de custo por usuário/org/feature
 * - alerta de orçamento por usuário
 */

import OpenAI from "openai";
import {
  COMPLEXITY,
  SYSTEM_INSTRUCTION_CONCISE,
  getModelForComplexity,
  getMaxTokensForComplexity,
} from "./openai-config.js";
import * as cache from "./openai-cache.js";
import { logUsage, checkBudget } from "./openai-cost.js";

const DEFAULT_COMPLEXITY = COMPLEXITY.MEDIUM;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

/**
 * Opções da chamada.
 * @typedef {object} ChatOptions
 * @property {string} [feature] - Nome da feature (copiloto, preco, marketing, etc.)
 * @property {string} [userId]
 * @property {string} [orgId]
 * @property {"short"|"analysis"} [outputType] - short → 250 tokens, analysis → 400
 * @property {string} [complexity] - COMPLEXITY.SIMPLE | MEDIUM | RARE
 * @property {string} [systemInstruction] - Concatena com SYSTEM_INSTRUCTION_CONCISE
 * @property {number} [cacheTtlMs] - TTL do cache; 0 = não usar cache
 * @property {boolean} [skipCache] - Se true, não consulta nem grava cache
 * @property {boolean} [skipLog] - Se true, não chama logUsage (quem chama é o caller, ex.: askAI)
 */

/**
 * Chama o modelo com todas as regras aplicadas.
 * @param {Array<{role: string, content: string}>} messages - Mensagens do chat (user/assistant/system)
 * @param {ChatOptions} [options]
 * @returns {Promise<{ content: string, usage?: { prompt_tokens: number, completion_tokens: number }, cached: boolean }>}
 */
export async function chat(messages, options = {}) {
  const {
    feature = "unknown",
    userId,
    orgId,
    outputType = "analysis",
    complexity = DEFAULT_COMPLEXITY,
    systemInstruction = "",
    cacheTtlMs = CACHE_TTL_MS,
    skipCache = false,
    skipLog = false,
    extraCreateOptions = {},
  } = options;

  const model = getModelForComplexity(complexity);
  const maxTokens = getMaxTokensForComplexity(complexity, outputType === "short" ? "SHORT" : "ANALYSIS");

  const systemParts = [SYSTEM_INSTRUCTION_CONCISE];
  if (systemInstruction) systemParts.push(systemInstruction);
  const fullSystem = systemParts.join("\n\n");

  const messagesWithSystem = [
    { role: "system", content: fullSystem },
    ...messages.filter((m) => m.role !== "system"),
  ];

  if (cacheTtlMs > 0 && !skipCache) {
    const cached = cache.get(model, messagesWithSystem, cacheTtlMs);
    if (cached) {
      if (!skipLog && cached.usage && (userId || orgId)) {
        logUsage({
          userId,
          orgId,
          feature,
          model,
          promptTokens: cached.usage.prompt_tokens ?? 0,
          completionTokens: cached.usage.completion_tokens ?? 0,
        });
      }
      return { content: cached.content, usage: cached.usage, cached: true };
    }
  }

  const budget = userId ? checkBudget(userId) : null;
  if (budget?.over) {
    throw new Error(
      `Orçamento mensal de IA atingido ($${budget.currentUsd.toFixed(2)} >= $${budget.limitUsd}). Tente no próximo mês ou ajuste o limite.`
    );
  }

  const openaiKey = process.env.OPENAI_KEY;
  if (!openaiKey || !openaiKey.startsWith("sk-")) {
    throw new Error("OPENAI_KEY não configurada ou inválida no .env");
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  const createParams = {
    model,
    messages: messagesWithSystem,
    max_tokens: maxTokens,
    ...extraCreateOptions,
  };
  const response = await openai.chat.completions.create(createParams);

  const content = response.choices?.[0]?.message?.content ?? "";
  const usage = response.usage
    ? {
        prompt_tokens: response.usage.prompt_tokens ?? 0,
        completion_tokens: response.usage.completion_tokens ?? 0,
      }
    : undefined;

  if (!skipLog && usage && (userId || orgId)) {
    logUsage({
      userId,
      orgId,
      feature,
      model,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
    });
  }

  if (cacheTtlMs > 0 && !skipCache) {
    cache.set(model, messagesWithSystem, content, usage, cacheTtlMs);
  }

  return { content, usage, cached: false };
}

/**
 * Atalho: uma única mensagem do usuário (sem histórico longo).
 * @param {string} userMessage
 * @param {ChatOptions} [options]
 */
export async function chatSingle(userMessage, options = {}) {
  return chat([{ role: "user", content: userMessage }], options);
}

export { COMPLEXITY, getModelForComplexity, getMaxTokensForComplexity };
export { logUsage, checkBudget, getCurrentMonthCostUsd } from "./openai-cost.js";
export { summarizeTransactions, summarizeClients, summarizeAgenda, summarizeGeneric } from "./openai-context.js";
