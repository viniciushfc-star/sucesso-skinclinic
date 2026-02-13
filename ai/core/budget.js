/**
 * Orçamento por usuário: normal | alerta | crítico.
 * enforceBudget: normal → segue; alerta → reduzir; crítico → bloquear.
 */

import {
  getCurrentMonthCostUsd,
  checkBudget,
} from "../../lib/openai-cost.js";
import { BUDGET_USD_PER_USER_PER_MONTH } from "../../lib/openai-config.js";

const THRESHOLD_ALERTA = 0.8;
const THRESHOLD_CRITICO = 1.0;

/**
 * Calcula gasto estimado do mês e retorna nível.
 * @param {string} [userId]
 * @returns {{ level: "normal"|"alerta"|"critico", currentUsd: number, limitUsd: number, percent: number }}
 */
export function getUserBudgetStatus(userId) {
  const limitUsd = BUDGET_USD_PER_USER_PER_MONTH;
  const currentUsd = userId ? getCurrentMonthCostUsd(userId) : 0;
  const percent = limitUsd > 0 ? currentUsd / limitUsd : 0;

  let level = "normal";
  if (percent >= THRESHOLD_CRITICO) level = "critico";
  else if (percent >= THRESHOLD_ALERTA) level = "alerta";

  return { level, currentUsd, limitUsd, percent };
}

/**
 * Dependendo do status: normal → segue; alerta → reduzir tokens/modelo; crítico → bloquear.
 * @param {string} [userId]
 * @returns {{ allow: boolean, reduceTokens?: boolean, useCheapestModel?: boolean, message?: string }}
 */
export function enforceBudget(userId) {
  const { level, currentUsd, limitUsd } = getUserBudgetStatus(userId);

  if (level === "critico") {
    return {
      allow: false,
      message: `Orçamento mensal de IA atingido ($${currentUsd.toFixed(2)} >= $${limitUsd}). Faça upgrade ou aguarde o próximo mês.`,
    };
  }

  if (level === "alerta") {
    return {
      allow: true,
      reduceTokens: true,
      useCheapestModel: true,
      message: `Uso de IA próximo do limite ($${currentUsd.toFixed(2)}/$${limitUsd}). Respostas podem ser mais curtas.`,
    };
  }

  return { allow: true };
}

export { getCurrentMonthCostUsd, checkBudget };

