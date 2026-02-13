/**
 * Nunca permitir envio de listas grandes.
 * summarizeContext() recebe dados brutos e retorna agregações, métricas, indicadores.
 */

import {
  summarizeTransactions,
  summarizeClients,
  summarizeAgenda,
  summarizeGeneric,
} from "../../lib/openai-context.js";

const MAX_ITEMS_RAW = 15;
const DEFAULT_TOP_N = 5;

/**
 * Tipos de contexto suportados para resumo automático.
 * @type {Record<string, (items: any[], topN?: number) => object>}
 */
const summarizers = {
  transactions: (items, topN = DEFAULT_TOP_N) =>
    summarizeTransactions(items || [], topN),
  clients: (items, topN = DEFAULT_TOP_N) =>
    summarizeClients(items || [], topN),
  agenda: (items, topN = 10) =>
    summarizeAgenda(items || [], topN),
  generic: (items, valueKey = "valor", topN = DEFAULT_TOP_N) =>
    summarizeGeneric(items || [], valueKey, topN),
};

/**
 * Resumir contexto: agregações, métricas, top N.
 * Se a lista tiver mais que maxItemsRaw, força resumo.
 * @param {object} rawContext - Dados brutos (ex.: { transactions: [], clients: [], agenda: [] })
 * @param {object} [opts]
 * @param {string} [opts.schema] - "transactions" | "clients" | "agenda" | "generic"
 * @param {string} [opts.valueKey] - Para generic: chave numérica (ex.: "valor", "quantidade")
 * @param {number} [opts.topN]
 * @param {number} [opts.maxItemsRaw]
 * @returns {object} Contexto resumido (totais, médias, top N, etc.)
 */
export function summarizeContext(rawContext, opts = {}) {
  if (!rawContext || typeof rawContext !== "object") return {};
  const {
    schema = "generic",
    valueKey = "valor",
    topN = DEFAULT_TOP_N,
    maxItemsRaw = MAX_ITEMS_RAW,
  } = opts;

  const out = {};
  const keys = Object.keys(rawContext);

  for (const key of keys) {
    const raw = rawContext[key];
    const arr = Array.isArray(raw) ? raw : [];
    const summarizer = summarizers[schema] || summarizers.generic;

    if (arr.length <= maxItemsRaw && schema === "generic") {
      out[key] = arr;
    } else if (arr.length > maxItemsRaw) {
      out[key] = summarizer(arr, topN);
    } else if (schema === "transactions") {
      out[key] = summarizer(arr, topN);
    } else if (schema === "clients") {
      out[key] = summarizer(arr, topN);
    } else if (schema === "agenda") {
      out[key] = summarizer(arr, topN);
    } else {
      out[key] = summarizers.generic(arr, valueKey, topN);
    }
  }
  return out;
}

/**
 * Resumo por tipo conhecido (atalho).
 */
export function summarizeTransactionsContext(items, topN = DEFAULT_TOP_N) {
  return summarizeTransactions(items || [], topN);
}

export function summarizeClientsContext(items, topN = DEFAULT_TOP_N) {
  return summarizeClients(items || [], topN);
}

export function summarizeAgendaContext(items, nextN = 10) {
  return summarizeAgenda(items || [], nextN);
}

export function summarizeGenericContext(items, valueKey = "valor", topN = DEFAULT_TOP_N) {
  return summarizeGeneric(items || [], valueKey, topN);
}

