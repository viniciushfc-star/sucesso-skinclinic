/**
 * Cache de respostas OpenAI por hash do payload.
 * Mesma pergunta + mesmos dados → reutilizar resposta (dentro do TTL).
 */

import { createHash } from "node:crypto";

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutos

const store = new Map();

function hashPayload(model, messages) {
  const payload = JSON.stringify({ model, messages });
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * @param {string} model
 * @param {Array<{role: string, content: string}>} messages
 * @param {number} [ttlMs]
 * @returns {{ content: string, usage?: object } | null}
 */
export function get(model, messages, ttlMs = DEFAULT_TTL_MS) {
  const key = hashPayload(model, messages);
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return { content: entry.content, usage: entry.usage };
}

/**
 * @param {string} model
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} content
 * @param {object} [usage]
 * @param {number} [ttlMs]
 */
export function set(model, messages, content, usage = null, ttlMs = DEFAULT_TTL_MS) {
  const key = hashPayload(model, messages);
  store.set(key, {
    content,
    usage,
    expiresAt: Date.now() + ttlMs,
  });
  // Limite grosseiro: não deixar o cache crescer indefinidamente
  if (store.size > 500) {
    const now = Date.now();
    for (const [k, v] of store.entries()) {
      if (v.expiresAt < now) store.delete(k);
    }
  }
}

export function clear() {
  store.clear();
}
