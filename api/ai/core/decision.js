/**
 * Pirâmide de decisão: a chamada ao modelo só é permitida se canCallAI retornar true.
 * Se qualquer camada (SQL, regra, estatística, template) resolver → não chamar IA.
 */

/**
 * Verifica se a IA é necessária com base na pirâmide de decisão.
 * @param {object} checks - Resultado das verificações do backend
 * @param {boolean} [checks.sqlResolve] - true se consulta SQL resolve
 * @param {boolean} [checks.regraResolve] - true se regra de negócio resolve
 * @param {boolean} [checks.estatisticaResolve] - true se cálculo estatístico resolve
 * @param {boolean} [checks.templateResolve] - true se template resolve
 * @returns {boolean} true = IA necessária (pode chamar); false = resolver via backend (não chamar)
 */
export function canCallAI(checks = {}) {
  if (!checks || typeof checks !== "object") return true;
  const {
    sqlResolve = false,
    regraResolve = false,
    estatisticaResolve = false,
    templateResolve = false,
  } = checks;
  if (sqlResolve || regraResolve || estatisticaResolve || templateResolve) {
    return false;
  }
  return true;
}

/**
 * Helper: tenta resposta determinística (total, média, contagem).
 * Use antes de askAI; se retornar string, responda com ela e não chame IA.
 * @param {object} data - Dados agregados (ex.: { total, count, media })
 * @param {string} question - Pergunta normalizada (lowercase)
 * @returns {string | undefined} Resposta se der para responder por regra; undefined caso contrário
 */
export function tryDeterministicAnswer(data, question) {
  if (!data || !question || typeof question !== "string") return undefined;
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
