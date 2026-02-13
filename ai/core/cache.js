/**
 * Se já existir resposta equivalente, retornar cache.
 */

import * as openaiCache from "../../lib/openai-cache.js";
import { createHash } from "node:crypto";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

function hashKey(key) {
  const str = typeof key === "string" ? key : JSON.stringify(key);
  return createHash("sha256").update(str).digest("hex");
}

/**
 * Executa fn e cacheia o resultado por key; se key já existir no cache, retorna sem chamar fn.
 * @param {string | object} cacheKey - Chave ou payload para hash
 * @param {() => Promise<{ content: string, usage?: object }>} fn - Função que chama o modelo
 * @param {number} [ttlMs]
 * @returns {Promise<{ content: string, usage?: object, cached: boolean }>}
 */
export async function cacheOrExecute(cacheKey, fn, ttlMs = DEFAULT_TTL_MS) {
  const key = hashKey(cacheKey);
  const cacheMessages = [{ role: "user", content: key }];
  const stored = openaiCache.get("cacheOrExecute", cacheMessages, ttlMs);
  if (stored?.content) {
    try {
      const parsed = JSON.parse(stored.content);
      return { ...parsed, cached: true };
    } catch (_) {
      return { content: stored.content, usage: stored.usage, cached: true };
    }
  }

  const result = await fn();
  const toStore = typeof result.content === "string"
    ? result.content
    : JSON.stringify({ content: result.content, usage: result.usage });
  openaiCache.set("cacheOrExecute", cacheMessages, toStore, result.usage, ttlMs);
  return { ...result, cached: false };
}

/**
 * Cache por model + messages (compatível com lib openai-cache).
 * @param {string} model
 * @param {Array<{role: string, content: string|array}>} messages
 * @param {number} [ttlMs]
 * @returns {{ content: string | null, usage?: object } | null}
 */
export function cacheGet(model, messages, ttlMs = DEFAULT_TTL_MS) {
  return openaiCache.get(model, messages, ttlMs);
}

/**
 * @param {string} model
 * @param {Array<{role: string, content: string|array}>} messages
 * @param {string} content
 * @param {object} [usage]
 * @param {number} [ttlMs]
 */
export function cacheSet(model, messages, content, usage, ttlMs = DEFAULT_TTL_MS) {
  openaiCache.set(model, messages, content, usage, ttlMs);
}

