/**
 * Guard: chamar IA apenas quando necessário.
 * Padrão para o caller declarar que não há resposta por SQL/regra/cálculo simples.
 */

/**
 * Use antes de chamar a IA quando houver alternativa.
 * Exemplo:
 *   const byRule = tryRespondByRule(pergunta, dados);
 *   if (byRule !== undefined) return byRule;
 *   const bySql = await tryRespondBySql(pergunta);
 *   if (bySql !== undefined) return bySql;
 *   return await chatSingle(prompt, { feature: "copiloto" });
 *
 * @param {string} reason - Motivo pelo qual a IA é necessária (para log)
 * @param {() => Promise<any> | any} fn - Função que chama a IA
 * @returns {Promise<any>}
 */
export async function whenIANeeded(reason, fn) {
  if (!reason || typeof reason !== "string") {
    console.warn("[OPENAI_GUARD] whenIANeeded chamado sem reason; use para documentar por que a IA foi usada.");
  }
  return fn();
}

/**
 * Tenta responder com regra determinística (ex.: totais, médias).
 * Retorna undefined se não for possível; nesse caso o caller deve chamar IA.
 * @param {object} data - Dados já agregados (ex.: resumo de financeiro)
 * @param {string} question - Pergunta normalizada (lowercase, trim)
 * @returns {string | undefined}
 */
export function tryDeterministicAnswer(data, question) {
  if (!data || !question) return undefined;
  const q = question.toLowerCase();

  if (q.includes("total") && typeof data.total === "number") {
    return `Total: ${data.total}${data.count != null ? ` (${data.count} itens)` : ""}.`;
  }
  if ((q.includes("média") || q.includes("media")) && typeof data.media === "number") {
    return `Média: ${data.media}.`;
  }
  if (q.includes("quantos") && data.count != null) {
    return `Quantidade: ${data.count}.`;
  }

  return undefined;
}

/**
 * Resumir histórico de conversa antes de enviar (nunca mandar conversas longas).
 * Mantém só as últimas N trocas e opcionalmente um resumo das anteriores.
 * @param {Array<{role: string, content: string}>} messages
 * @param {number} keepLast - Quantas trocas manter
 * @param {string} [summaryPrevious] - Resumo das mensagens antigas (se já tiver)
 * @returns {Array<{role: string, content: string}>}
 */
export function trimHistory(messages, keepLast = 3, summaryPrevious = "") {
  const filtered = messages.filter((m) => m.role && m.content);
  if (filtered.length <= keepLast * 2) return filtered;

  const kept = filtered.slice(-keepLast * 2);
  const system = summaryPrevious
    ? [{ role: "system", content: `Contexto resumido das mensagens anteriores: ${summaryPrevious}` }]
    : [];
  return [...system, ...kept];
}
