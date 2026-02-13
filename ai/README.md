# Camada oficial de acesso à IA (`api/ai/core`)

Este módulo é o **único ponto permitido** para chamadas a modelos de linguagem no SaaS. Nenhuma rota ou serviço pode usar a API da OpenAI (ou outro provedor) diretamente.

**Objetivos:** previsibilidade de custo, controle de margem, roteamento inteligente de modelos e observabilidade financeira.

---

## Design do módulo

```
api/ai/core/
├── index.js      → askAI() + reexporta todos os wrappers
├── decision.js   → canCallAI, tryDeterministicAnswer (pirâmide)
├── summarizer.js → summarizeContext + atalhos por schema
├── models.js     → selectModel(complexity)
├── limits.js     → enforceTokenLimit
├── budget.js     → getUserBudgetStatus, enforceBudget
├── cache.js      → cacheOrExecute
└── cost.js       → logAICost
```

- **Entrada única:** `askAI(opts)`.
- **Implementação real:** `api/lib/openai-client.js` (chamada à API). O core usa `chat()` com `skipCache` e `skipLog`; cache e log ficam no core.
- **Fluxo obrigatório:** 1) canCallAI 2) summarizeContext 3) cache 4) enforceBudget 5) selectModel 6) enforceTokenLimit 7) execute 8) logAICost 9) return.

---

## Tipos / interfaces

### AskAIOptions (askAI)

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| userId | string | não | Para orçamento e log |
| orgId | string | não | Para log e dashboards |
| feature | string | sim | Ex.: "copiloto", "preco", "marketing" |
| question | string | sim* | Pergunta ou prompt (* não se usar `messages`) |
| rawContext | object | não | Dados brutos (serão resumidos) |
| complexity | "simple" \| "medium" \| "rare" | não | Default: "medium" |
| checks | object | não | canCallAI: sqlResolve, regraResolve, estatisticaResolve, templateResolve |
| outputType | "short" \| "analysis" | não | Default: "analysis" |
| systemInstruction | string | não | Concatena com instrução padrão |
| skipCache | boolean | não | Default: false |
| cacheTtlMs | number | não | Default: 5 min |
| summarizeOpts | object | não | schema, topN, maxItemsRaw para summarizeContext |
| messages | array | não | Se informado, substitui question (multimodal) |
| extraCreateOptions | object | não | Ex.: response_format, max_tokens |

### Retorno askAI

`Promise<{ content: string, usage?: { prompt_tokens, completion_tokens }, cached: boolean }>`

### Wrappers (assinaturas)

- **canCallAI(checks)** → `boolean`. `true` = pode chamar IA; `false` = resolver no backend.
- **summarizeContext(rawContext, opts)** → objeto resumido (agregações/métricas).
- **selectModel(complexity)** → `string` (nome do modelo).
- **enforceTokenLimit(complexity, outputType, opts?)** → `number` (max_tokens). Aumento só com `override` + `justification` em lista permitida.
- **getUserBudgetStatus(userId)** → `{ level: "normal"|"alerta"|"critico", currentUsd, limitUsd, percent }`.
- **enforceBudget(userId)** → `{ allow, reduceTokens?, useCheapestModel?, message? }`.
- **cacheOrExecute(cacheKey, fn, ttlMs)** → resultado de `fn()` ou do cache.
- **logAICost(record)** → registro obrigatório (userId, orgId, feature, model, promptTokens, completionTokens).

---

## Exemplo de uso

```js
import { askAI, canCallAI, COMPLEXITY } from "../ai/core/index.js";

// Na rota (ex.: copiloto):
const checks = {
  sqlResolve: await podeResponderComSql(pergunta),
  regraResolve: temRegra(pergunta),
  estatisticaResolve: temMetrica(pergunta),
  templateResolve: temTemplate(pergunta),
};

if (!canCallAI(checks)) {
  return reply.send({ answer: await resolverNoBackend(pergunta), source: "backend" });
}

const { content, usage, cached } = await askAI({
  userId: req.user?.id,
  orgId: req.user?.orgId,
  feature: "copiloto",
  question: pergunta,
  rawContext: { transactions: listaResumida, clients: [] },
  complexity: COMPLEXITY.MEDIUM,
  checks,
  outputType: "analysis",
  systemInstruction: "Responda como assistente da clínica.",
  summarizeOpts: { schema: "transactions", topN: 10 },
});

return reply.send({ answer: content, usage, cached });
```

---

## Pontos de extensão

1. **Novo schema de resumo**  
   Em `summarizer.js`: adicionar caso em `summarizeContext` (ex.: `schema: "invoices"`) e opcionalmente atalho `summarizeInvoicesContext`. O resumo em si pode ficar em `api/lib/openai-context.js`.

2. **Nova justificativa de teto de tokens**  
   Em `limits.js`: incluir o identificador em `JUSTIFIED_OVERRIDES` (ex.: `"relatorio_longo"`) e usar `enforceTokenLimit(..., { override: 800, justification: "relatorio_longo" })`.

3. **Novo nível de orçamento**  
   Em `budget.js`: ajustar `THRESHOLD_ALERTA` / `THRESHOLD_CRITICO` ou adicionar nível intermediário e tratar em `enforceBudget`.

4. **Novo modelo por complexidade**  
   Em `api/lib/openai-config.js`: alterar mapeamento em `getModelForComplexity`. O core usa esse mapeamento via `models.js`.

5. **Novo tipo de saída (outputType)**  
   Em `api/lib/openai-config.js`: adicionar max_tokens para o novo tipo em `getMaxTokensForComplexity`; em `limits.js` espelhar se necessário.

---

## Estratégia de testes

- **Unitários**
  - **decision:** `canCallAI` retorna false quando algum check é true; retorna true quando todos false. `tryDeterministicAnswer` com totais/médias.
  - **budget:** `getUserBudgetStatus` retorna normal/alerta/crítico conforme percent; `enforceBudget` retorna allow/reduceTokens/useCheapestModel conforme nível.
  - **limits:** `enforceTokenLimit` retorna teto padrão; com override sem justificativa lança; com justificativa em lista aceita.
  - **summarizer:** com rawContext vazio ou schema conhecido, resposta é objeto (não lista gigante).

- **Integração (askAI)**
  - Mock de `api/lib/openai-client.js` (chat) e de `openai-cost.js` (logUsage).
  - Cenário: checks todos false → askAI chama summarizeContext, enforceBudget, selectModel, enforceTokenLimit, chat, logAICost.
  - Cenário: canCallAI false → askAI lança antes de chamar o modelo.
  - Cenário: enforceBudget.allow false → askAI lança com mensagem de orçamento.
  - Verificar que logAICost é chamado exatamente uma vez por execução (e uma vez por hit de cache com usage).

- **Política “não usar IA fora do core”**
  - Grep por `openai.chat.completions.create`, `new OpenAI(`, `from "openai"` fora de `api/lib` e `api/ai/core`: deve ser vazio.
  - Rotas devem importar apenas `api/ai/core` (e eventualmente `api/lib` só para tipos/helpers não-IA).

---

## Resumo

- Toda chamada ao modelo passa por **askAI** em `api/ai/core`.
- Os 8 wrappers (canCallAI, summarizeContext, selectModel, enforceTokenLimit, getUserBudgetStatus, enforceBudget, cacheOrExecute, logAICost) estão implementados e são usados no fluxo de askAI.
- Nenhum desenvolvedor deve chamar a API de IA fora deste padrão.

