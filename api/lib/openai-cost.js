/**
 * Log de custo por usuário, organização e feature.
 * Alerta se orçamento mensal por usuário ultrapassar limite.
 */

import {
  BUDGET_USD_PER_USER_PER_MONTH,
  PRICE_PER_1K,
} from "./openai-config.js";

const usageByUserMonth = new Map();

function keyUserMonth(userId, yearMonth) {
  return `${userId || "anonymous"}:${yearMonth}`;
}

function getYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function estimateCost(model, inputTokens, outputTokens) {
  const prices = PRICE_PER_1K[model];
  if (!prices) return 0;
  return (
    (inputTokens / 1000) * prices.input +
    (outputTokens / 1000) * prices.output
  );
}

/**
 * Registra uso e retorna custo estimado em USD.
 * @param {object} opts
 * @param {string} [opts.userId]
 * @param {string} [opts.orgId]
 * @param {string} opts.feature - ex: "copiloto", "preco", "marketing"
 * @param {string} opts.model
 * @param {number} opts.promptTokens
 * @param {number} opts.completionTokens
 */
export function logUsage({ userId, orgId, feature, model, promptTokens, completionTokens }) {
  const cost = estimateCost(model, promptTokens, completionTokens);
  const ym = getYearMonth();

  const logLine = {
    ts: new Date().toISOString(),
    userId: userId || null,
    orgId: orgId || null,
    feature: feature || "unknown",
    model,
    promptTokens,
    completionTokens,
    costUsd: Math.round(cost * 1e6) / 1e6,
  };
  console.log("[OPENAI_COST]", JSON.stringify(logLine));

  if (userId) {
    const key = keyUserMonth(userId, ym);
    const prev = usageByUserMonth.get(key) || { tokens: 0, costUsd: 0 };
    usageByUserMonth.set(key, {
      tokens: prev.tokens + promptTokens + completionTokens,
      costUsd: prev.costUsd + cost,
    });
  }

  return cost;
}

/**
 * Retorna custo acumulado do usuário no mês atual (USD).
 */
export function getCurrentMonthCostUsd(userId) {
  if (!userId) return 0;
  const key = keyUserMonth(userId, getYearMonth());
  const entry = usageByUserMonth.get(key);
  return entry ? entry.costUsd : 0;
}

/**
 * Verifica se o usuário já ultrapassou o orçamento mensal.
 * @returns {{ over: boolean, currentUsd: number, limitUsd: number }}
 */
export function checkBudget(userId) {
  const currentUsd = getCurrentMonthCostUsd(userId);
  const limitUsd = BUDGET_USD_PER_USER_PER_MONTH;
  const over = currentUsd >= limitUsd;
  if (over) {
    console.warn(
      `[OPENAI_BUDGET] Usuário ${userId} ultrapassou orçamento: $${currentUsd.toFixed(2)} >= $${limitUsd}`
    );
  }
  return { over, currentUsd, limitUsd };
}
