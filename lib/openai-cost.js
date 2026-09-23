/**
 * Log de custo por usuário, organização e feature.
 * Alerta se orçamento mensal por usuário ultrapassar limite.
 */

import {
  BUDGET_USD_PER_USER_PER_MONTH,
  PRICE_PER_1K,
} from "./openai-config.js";
import { getAdminClient } from "./api-auth.js";

const usageByUserMonth = new Map();
const pendingByUserMonth = new Map();

function keyUserMonth(userId, yearMonth) {
  return `${userId || "anonymous"}:${yearMonth}`;
}

function getYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
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

  persistUsageEvent(logLine).catch(() => {});

  return cost;
}

async function persistUsageEvent(logLine) {
  try {
    const admin = getAdminClient();
    const { error } = await admin.from("ai_usage_events").insert({
      org_id: isUuid(logLine.orgId) ? logLine.orgId : null,
      user_id: isUuid(logLine.userId) ? logLine.userId : null,
      feature: logLine.feature,
      model: logLine.model,
      prompt_tokens: logLine.promptTokens,
      completion_tokens: logLine.completionTokens,
      cost_usd: logLine.costUsd,
    });
    if (error) console.warn("[OPENAI_COST] persist", error.message);
  } catch (e) {
    console.warn("[OPENAI_COST] persist skip", e?.message || e);
  }
}

/**
 * Soma custo do mês a partir do banco (serverless). Falha = ignora.
 */
export async function hydrateMonthCostFromDb(budgetKey) {
  if (!budgetKey) return;
  try {
    const admin = getAdminClient();
    const ym = getYearMonth();
    const start = `${ym}-01T00:00:00.000Z`;
    let query = admin.from("ai_usage_events").select("cost_usd").gte("created_at", start);
    if (isUuid(budgetKey)) query = query.eq("user_id", budgetKey);
    else if (String(budgetKey).startsWith("org:")) {
      const orgId = String(budgetKey).slice(4);
      if (!isUuid(orgId)) return;
      query = query.eq("org_id", orgId);
    } else return;
    const { data, error } = await query;
    if (error || !data) return;
    const sum = data.reduce((acc, row) => acc + Number(row.cost_usd || 0), 0);
    const key = keyUserMonth(budgetKey, ym);
    const prev = usageByUserMonth.get(key) || { tokens: 0, costUsd: 0 };
    if (sum > prev.costUsd) {
      usageByUserMonth.set(key, { tokens: prev.tokens, costUsd: sum });
    }
  } catch (_) {
    /* tabela ausente ou env de teste */
  }
}

/**
 * Retorna custo acumulado do usuário no mês atual (USD).
 */
export function getCurrentMonthCostUsd(userId) {
  if (!userId) return 0;
  const key = keyUserMonth(userId, getYearMonth());
  const entry = usageByUserMonth.get(key);
  const pending = pendingByUserMonth.get(key) || 0;
  return (entry ? entry.costUsd : 0) + pending;
}

/** Reserva custo estimado antes da chamada (evita duas IAs paralelas furarem o teto no mesmo isolate). */
export function reserveBudget(userId, estimateUsd = 0.03) {
  const amount = Number(estimateUsd) || 0;
  if (!userId || amount <= 0) return { ok: true, amount: 0 };
  const limitUsd = BUDGET_USD_PER_USER_PER_MONTH;
  const currentUsd = getCurrentMonthCostUsd(userId);
  if (currentUsd + amount > limitUsd) {
    return { ok: false, amount: 0 };
  }
  const key = keyUserMonth(userId, getYearMonth());
  pendingByUserMonth.set(key, (pendingByUserMonth.get(key) || 0) + amount);
  return { ok: true, amount };
}

export function releaseBudget(userId, amount) {
  const n = Number(amount) || 0;
  if (!userId || n <= 0) return;
  const key = keyUserMonth(userId, getYearMonth());
  const next = Math.max(0, (pendingByUserMonth.get(key) || 0) - n);
  if (next === 0) pendingByUserMonth.delete(key);
  else pendingByUserMonth.set(key, next);
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
