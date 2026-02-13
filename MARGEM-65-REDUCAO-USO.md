# Reduzir uso para manter margem ≥ 65% por usuário pagante

Sua meta: **faturamento com mais de 65% de margem** por usuário pagante.  
Isso implica **custo ≤ 35% da receita**. Com redução de uso (limites + modelo mais barato onde der), dá para manter esse ganho sem subir preço.

---

## 1. A matemática da margem

- **Margem = (Receita − Custo) / Receita**
- **Margem ≥ 65%** ⇒ **Custo ≤ 35% da Receita**
- Exemplos:
  - Cobra **R$ 59/usuário/mês**, 3 usuários ⇒ Receita = R$ 177. Custo máximo = 0,35 × 177 = **R$ 62**.
  - Cobra **R$ 49/usuário/mês**, 3 usuários ⇒ Receita = R$ 147. Custo máximo = **R$ 51,45**.

No cenário anterior (uso moderado, sem limites), o custo por clínica estava em **R$ 64–84**. Para ficar **≤ 35% da receita**, é preciso **reduzir custo** — em especial OpenAI, que é a maior parte.

---

## 2. Onde cortar custo (sem quebrar o produto)

A maior parte do custo é **OpenAI**. Duas alavancas:

1. **Usar gpt-4o-mini** onde a qualidade não exige gpt-4o (respostas curtas, tarefas simples).
2. **Limitar uso** das funções mais caras (Copilot, análises de pele com foto, etc.).

Com isso, o custo por clínica cai para algo na faixa de **R$ 45–55/mês**, e a margem sobe para **65%+** nos preços que você imagina.

---

## 3. Regras de uso sugeridas (para manter 65%+ margem)

### 3.1 Copilot (maior consumidor de tokens)

- **Limite:** 25 perguntas por usuário por mês (ou 2 por dia, o que for menor).
- **Contexto:** reduzir tamanho do contexto por chamada:
  - Clientes: 20 em vez de 30.
  - Financeiro: 20 em vez de 30.
  - Agenda: 15 em vez de 20.
- **Modelo:** manter **gpt-4o** (contexto e qualidade da resposta justificam).

Efeito: de ~40 perguntas × 5.500 tokens (375k/usuário) para 25 × ~3.500 ≈ 87,5k/usuário. Para 3 usuários: **~262.500 tokens/mês** (em vez de 1.125.000). Redução grande de custo.

### 3.2 Análise de pele (portal do cliente)

- **Limite:** 40 envios por clínica por mês incluídos no plano (ou 50, conforme o preço).
- Acima disso: bloquear com mensagem “Limite do plano atingido” ou oferecer pacote extra.

Efeito: 60 → 40 análises × 3.000 tokens = **120.000 tokens/mês** (em vez de 180.000). Continua usando **gpt-4o** (visão).

### 3.3 Trocar para gpt-4o-mini onde fizer sentido

Usar **gpt-4o-mini** (bem mais barato) em:

| API | Motivo |
|-----|--------|
| Preço | Resposta curta, JSON simples. |
| Estoque | Idem. |
| Marketing | Texto longo mas tarefa estruturada; mini costuma atender. |
| Estudo de caso (pergunta + esclarecer) | Texto didático; mini suficiente em muitos casos. |
| Discussão de caso | Idem. |
| Protocolo | JSON + texto curto. |
| Skincare | JSON + rotinas. |
| OCR (parse) | Já é gpt-4o-mini. |

Manter **gpt-4o** em:

- **Copilot** (contexto rico, tom e coerência importantes).
- **Pele** (visão: 2–4 fotos).
- **Análise de pele (portal)** (visão: até 5 fotos + texto).

### 3.4 Pele (análise com imagens no dashboard)

- **Limite:** 15 chamadas por usuário por mês (ou 1 por dia).
- Modelo: **gpt-4o** (visão).

Isso segura o custo de “Pele” em nível previsível.

---

## 4. Custo estimado após as reduções (1 clínica, 3 usuários)

Premissas: limites acima; resto em gpt-4o-mini; Supabase free; hosting ~R$ 35.

| Item | Cálculo | Custo (R$/mês) |
|------|---------|-----------------|
| **Copilot** (25/user, contexto reduzido) | 262.500 tokens × US$ 4,50/1M × R$ 5,80 | ~6,85 |
| **Portal análise de pele** (40 envios) | 120.000 tokens × US$ 4,50/1M × R$ 5,80 | ~3,13 |
| **Pele** (15/user × 3 = 45 calls × 2.500) | 112.500 tokens × US$ 4,50/1M × R$ 5,80 | ~2,94 |
| **Demais** (Marketing, Preço, Estoque, Estudo, Discussão, Protocolo, Skincare, OCR) em **gpt-4o-mini** | ~124k tokens × US$ 0,25/1M × R$ 5,80 | ~0,18 |
| **Subtotal OpenAI** | | **~13,10** |
| Supabase | Free | 0 |
| Hosting | | 35 |
| **Total** | | **~R$ 48–50** |

Arredondando com folga: **custo por clínica ≈ R$ 50–55/mês**.

---

## 5. Conferindo a margem ≥ 65%

- **Receita:** R$ 59/usuário × 3 = **R$ 177/mês**.
- **Custo:** R$ 50 (cenário com limites).
- **Margem:** (177 − 50) / 177 ≈ **71,8%** (acima de 65%).

Se cobrar **R$ 49/usuário** (R$ 147 total):

- Custo máximo para 65% margem = 0,35 × 147 = R$ 51,45.
- Custo com limites ≈ R$ 50 ⇒ margem ≈ **66%** (no alvo).

Ou seja: com **uso reduzido e limites** você consegue **manter ganho de mais de 65% por usuário pagante**.

---

## 6. Resumo das mudanças no produto

| O que | Ação |
|-------|------|
| **Copilot** | Limite 25 perguntas/usuário/mês (ou 2/dia); contexto menor (menos clientes, financeiro e agenda). |
| **Análise de pele (portal)** | Limite 40 (ou 50) envios por clínica/mês no plano base. |
| **Pele (dashboard)** | Limite 15 chamadas/usuário/mês. |
| **Preço, Estoque, Marketing, Estudo de caso, Discussão, Protocolo, Skincare** | Usar **gpt-4o-mini** em vez de gpt-4o. |
| **Copilot, Pele, Análise de pele (portal)** | Manter **gpt-4o**. |

---

## 7. Implementação técnica (resumo)

1. **Limites por usuário/org**
   - Guardar contadores no Supabase (ex.: tabela `usage_limits` ou colunas em `organization_users` / `organizations`): perguntas Copilot no mês, chamadas Pele no mês; análises de pele (portal) no mês por org.
   - Antes de chamar a API: checar limite; se estourou, retornar mensagem amigável (“Limite do seu plano neste mês. Renova em DD/MM.”).

2. **Copilot: menos contexto**
   - Em `api/copiloto.js`: reduzir `.limit(50)` de clientes para 20, de financeiro para 20, de agenda para 15 (ou valores nessa linha).

3. **Trocar modelo para gpt-4o-mini**
   - Em cada handler (Preço, Estoque, Marketing, Estudo de caso, Discussão, Protocolo, Skincare): onde hoje está `model: "gpt-4o"`, usar `model: "gpt-4o-mini"`. Testar uma vez cada um para garantir que a resposta ainda é aceitável.

4. **Portal: limite de análises**
   - Em `api/analise-pele.js`: antes de chamar a IA, consultar quantas análises a org já fez no mês; se ≥ 40 (ou 50), retornar 200 com mensagem “Limite de análises do plano atingido para este mês.”

Com isso, o uso fica controlado e o custo alinha com sua estimativa de **faturamento com mais de 65% de margem por usuário pagante**, com margem de erro adequada (ex.: 65–70% de margem mesmo com pequenos picos ou câmbio um pouco pior).
