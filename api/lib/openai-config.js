/**
 * Configuração central da integração OpenAI.
 * Regras: economia de tokens, max_tokens baixo, modelos por complexidade.
 */

/** Níveis de complexidade → modelo (custo crescente) */
export const COMPLEXITY = {
  /** Respostas curtas, classificações, extração simples */
  SIMPLE: "simple",
  /** Análises, recomendações, resumos */
  MEDIUM: "medium",
  /** Raro: raciocínio profundo, múltiplas etapas */
  RARE: "rare",
};

/** Modelo por complexidade (prioridade: custo baixo) */
export const MODEL_BY_COMPLEXITY = {
  [COMPLEXITY.SIMPLE]: "gpt-4o-mini",
  [COMPLEXITY.MEDIUM]: "gpt-4o-mini",
  [COMPLEXITY.RARE]: "gpt-4o",
};

/** Limite de tokens de saída por tipo de uso */
export const MAX_TOKENS = {
  /** Respostas curtas: bullets, uma frase, classificação */
  SHORT: 250,
  /** Análises, sugestões, resumos */
  ANALYSIS: 400,
  /** Máximo absoluto (evitar respostas longas) */
  CAP: 500,
};

/** Instrução fixa no system: respostas objetivas */
export const SYSTEM_INSTRUCTION_CONCISE =
  "Seja direto, use bullets, evite texto longo. Não repita o enunciado.";

/** Orçamento mensal por usuário (USD) — alertar se ultrapassar */
export const BUDGET_USD_PER_USER_PER_MONTH = 2;

/** Preços aproximados por 1k tokens (USD) — ajustar conforme pricing OpenAI */
export const PRICE_PER_1K = {
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
};

export function getMaxTokensForComplexity(complexity, type = "ANALYSIS") {
  const cap = complexity === COMPLEXITY.RARE ? MAX_TOKENS.ANALYSIS : MAX_TOKENS[type] ?? MAX_TOKENS.SHORT;
  return Math.min(cap, MAX_TOKENS.CAP);
}

export function getModelForComplexity(complexity) {
  return MODEL_BY_COMPLEXITY[complexity] ?? MODEL_BY_COMPLEXITY[COMPLEXITY.SIMPLE];
}
