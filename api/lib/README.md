# Lib OpenAI — Regras de uso

Wrapper que **força** economia de tokens e custo previsível.

## Uso básico

```js
import { chat, chatSingle, COMPLEXITY } from "./lib/openai-client.js";

// Uma pergunta, resposta curta (max 250 tokens)
const { content } = await chatSingle("Qual o total de clientes?", {
  feature: "copiloto",
  userId: "uuid",
  orgId: "uuid",
  outputType: "short",
  complexity: COMPLEXITY.SIMPLE,
});

// Análise (max 400 tokens), modelo por complexidade
const { content: analysis } = await chat(
  [{ role: "user", content: prompt }],
  {
    feature: "marketing",
    orgId: "uuid",
    outputType: "analysis",
    complexity: COMPLEXITY.MEDIUM,
    systemInstruction: "Você é o Copilot de Marketing…",
    cacheTtlMs: 5 * 60 * 1000,
  }
);
```

## Regras aplicadas pelo wrapper

| Regra | Implementação |
|-------|----------------|
| Chamar IA só quando necessário | Use `tryDeterministicAnswer()` antes; opcional `whenIANeeded(reason, fn)` |
| Redução de contexto | `summarizeTransactions`, `summarizeClients`, `summarizeAgenda` em `openai-context.js` |
| Limite de tokens de saída | `MAX_TOKENS.SHORT` (250), `ANALYSIS` (400), `CAP` (500) em config |
| Respostas objetivas | `SYSTEM_INSTRUCTION_CONCISE` injetada em toda chamada |
| Cache | Hash do payload + TTL; `cacheTtlMs` em opções |
| Classificação de complexidade | `COMPLEXITY.SIMPLE` → gpt-4o-mini, `MEDIUM` → gpt-4o-mini, `RARE` → gpt-4o |
| Orçamento por usuário | `checkBudget(userId)` antes da chamada; log em `[OPENAI_COST]` |
| Histórico curto | `trimHistory(messages, keepLast, summaryPrevious)` em openai-guard.js |
| OCR/imagem | Extrair dados estruturados primeiro; enviar só resumo ao modelo (na sua rota) |
| Log de custo | `logUsage({ userId, orgId, feature, model, promptTokens, completionTokens })` |

## Arquivos

- **openai-config.js** — Limites, modelos por complexidade, preços, orçamento.
- **openai-cache.js** — Cache em memória por hash do payload.
- **openai-cost.js** — Log de tokens por usuário/org/feature; alerta de orçamento.
- **openai-context.js** — Pré-agregação (totais, top N, por dia) para não enviar listas grandes.
- **openai-client.js** — Wrapper principal: `chat()` e `chatSingle()`.
- **openai-guard.js** — `tryDeterministicAnswer`, `trimHistory`, `whenIANeeded`.

## Orçamento

- Limite padrão: **US$ 2/usuário/mês** (`BUDGET_USD_PER_USER_PER_MONTH`).
- Ao ultrapassar, a chamada lança e o app pode exibir mensagem ao usuário.
- Ajuste em `openai-config.js` ou por variável de ambiente (se implementado).
