# Estimativa de tokens por usuário/mês (OpenAI)

Estimativa para **um usuário de equipe** (gestor/profissional) que usa as funcionalidades com IA no sistema. Valores em **tokens totais** (entrada + saída) por mês.

---

## Modelos usados no projeto

| API | Modelo | Observação |
|-----|--------|-------------|
| Copilot, Marketing, Preço, Estoque, Estudo de caso, Discussão caso, Protocolo, Pele, Skincare, Análise de pele | **gpt-4o** | Texto e visão (imagens) |
| OCR (extração de campos) | **gpt-4o-mini** | Só quando usa IA para interpretar texto |

---

## Tokens médios por chamada (aproximado)

| Funcionalidade | Input (aprox.) | Output (aprox.) | Total/call |
|----------------|----------------|-----------------|------------|
| **Copilot** | 4.000–6.000 (contexto clínica + pergunta) | 300–600 | ~5.500 |
| **Marketing** | 1.000–2.000 | 800–1.500 | ~2.400 |
| **Preço** | 300–500 | 250–400 | ~700 |
| **OCR** | 500–1.000 (texto) | 150–300 | ~800 |
| **Estoque** | 400–800 | 300–500 | ~1.000 |
| **Estudo de caso (pergunta + esclarecer)** | 1.000–2.000 | 400–800 | ~2.100 |
| **Discussão de caso** | 800–1.500 | 500–1.000 | ~1.800 |
| **Protocolo** | 600–1.000 | 400–600 | ~1.300 |
| **Pele** (com imagens) | 1.500–3.000 (2–4 fotos + texto) | 300–600 | ~2.500 |
| **Skincare** | 600–1.000 | 400–700 | ~1.300 |
| **Análise de pele (portal)** | 2.000–3.500 (até 5 fotos + respostas) | 400–700 | ~3.000 |

*A Análise de pele (portal) é por **envio do cliente**; não entra na conta “por usuário de equipe”.*

---

## Cenários de uso por usuário/mês

### Uso leve (poucas vezes por semana)

| Funcionalidade | Chamadas/mês | Tokens (aprox.) |
|----------------|--------------|-----------------|
| Copilot | 15 | 82.500 |
| Marketing | 1 | 2.400 |
| Preço | 2 | 1.400 |
| OCR | 5 | 4.000 |
| Estoque | 2 | 2.000 |
| Estudo de caso | 5 | 10.500 |
| Discussão caso | 2 | 3.600 |
| Protocolo | 3 | 3.900 |
| Pele | 5 | 12.500 |
| Skincare | 5 | 6.500 |
| **Total** | | **~130.000** |

### Uso moderado (uso diário em parte das funções)

| Funcionalidade | Chamadas/mês | Tokens (aprox.) |
|----------------|--------------|-----------------|
| Copilot | 40 | 220.000 |
| Marketing | 3 | 7.200 |
| Preço | 6 | 4.200 |
| OCR | 15 | 12.000 |
| Estoque | 6 | 6.000 |
| Estudo de caso | 15 | 31.500 |
| Discussão caso | 8 | 14.400 |
| Protocolo | 10 | 13.000 |
| Pele | 20 | 50.000 |
| Skincare | 15 | 19.500 |
| **Total** | | **~375.000** |

### Uso intenso (várias pessoas e uso frequente)

| Funcionalidade | Chamadas/mês | Tokens (aprox.) |
|----------------|--------------|-----------------|
| Copilot | 80 | 440.000 |
| Marketing | 6 | 14.400 |
| Preço | 15 | 10.500 |
| OCR | 40 | 32.000 |
| Estoque | 15 | 15.000 |
| Estudo de caso | 35 | 73.500 |
| Discussão caso | 20 | 36.000 |
| Protocolo | 25 | 32.500 |
| Pele | 50 | 125.000 |
| Skincare | 35 | 45.500 |
| **Total** | | **~800.000** |

---

## Resumo por usuário/mês

| Cenário | Tokens/usuário/mês (aprox.) |
|---------|-----------------------------|
| Leve | **~130.000** |
| Moderado | **~375.000** |
| Intenso | **~800.000** |

Na prática, para **um usuário típico** (gestor ou profissional usando o sistema todo dia, mas sem exagero), um número razoável é **200.000 a 400.000 tokens/mês**.

---

## Custo aproximado (OpenAI, preços típicos)

- **gpt-4o**: input ~US$ 2,50 / 1M tokens, output ~US$ 10 / 1M tokens. Média ponderada ~US$ 4–5 / 1M tokens.
- **gpt-4o-mini**: bem mais barato; o OCR usa pouco volume.

Para **400.000 tokens/mês** em gpt-4o:  
400k × (4,5 / 1.000.000) ≈ **US$ 1,80 por usuário/mês** (ordem de grandeza).

---

## Análise de pele no portal (por clínica, não por usuário)

Cada **envio de análise** (cliente no portal) ≈ 3.000 tokens (até 5 fotos + respostas).

- 50 análises/mês por clínica → **~150.000 tokens**
- 150 análises/mês → **~450.000 tokens**

Somando ao uso da equipe, uma **clínica com 3 usuários em uso moderado + 80 análises de pele** fica na faixa de:

- 3 × 375k = 1.125.000 (equipe)  
- 80 × 3k = 240.000 (portal)  
- **Total ≈ 1.365.000 tokens/mês** (~US$ 6–7/mês em gpt-4o).

---

## Como reduzir uso de tokens

1. **Copilot**: limitar tamanho do contexto (ex.: menos clientes/transações/agenda no prompt) ou cache de contexto.
2. **Pele / Análise de pele**: reduzir número ou resolução das imagens enviadas à API.
3. **Funções simples**: usar **gpt-4o-mini** onde for suficiente (ex.: OCR já usa; eventualmente Preço, Estoque, respostas curtas).
4. **Limites por usuário**: limite de perguntas/dia ou/mês no Copilot e em outras telas para evitar picos.

Os números acima são **estimativas**; o consumo real depende de quantos dados vão no contexto (ex.: quantidade de clientes/agenda) e do tamanho das respostas da IA.
