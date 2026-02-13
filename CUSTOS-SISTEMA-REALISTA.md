# Análise de custos realista — sistema completo

Objetivo: **quanto você gastaria por mês** para rodar o sistema e **qual preço cobrar** para não ter prejuízo, com margem de segurança.

---

## 1. O que o sistema consome (serviços)

| Serviço | Uso no projeto | Cobrança típica |
|--------|----------------|-----------------|
| **OpenAI** | Copilot, Marketing, Preço, Estoque, Estudo de caso, Discussão, Protocolo, Pele, Skincare, Análise de pele (portal), OCR (parse) | Por token (entrada + saída). gpt-4o ~US$ 2,50/1M input, ~US$ 10/1M output. Média ~US$ 4–5/1M tokens. |
| **Supabase** | Banco, Auth, Storage (fotos análise de pele), Realtime (se usar) | Free até certo uso; depois Pro ~US$ 25/mês. |
| **Google Cloud Vision** | OCR (leitura de texto em imagem/nota fiscal) em `api/ocr.js` | 1.000 unidades/mês grátis; depois ~US$ 1,50/1.000 imagens. |
| **Google Calendar API** | Integração opcional (sync agenda) | Dentro de cota gratuita para uso normal. |
| **Hosting (Node)** | Servidor que roda `server.js` + APIs | Vercel/Railway/Render: free tier ou ~US$ 5–15/mês. VPS: ~US$ 5–10/mês. |
| **Domínio** | Opcional (subdomínio do host já resolve) | ~R$ 40/ano ou já incluso em algum plano. |

---

## 2. Cenário base: uma clínica, uso realista

Premissas:

- **1 organização (clínica)**
- **3 usuários de equipe** (gestor + 2 profissionais) com uso **moderado** (não todo mundo todo dia em tudo)
- **60 análises de pele no portal** por mês (clientes enviando fotos + respostas)
- **OCR**: 20 notas/recibos por mês (imagem → Google Vision + parse com OpenAI)
- **Google Calendar**: 2 usuários conectados (cota gratuita)

### 2.1 OpenAI (gpt-4o + gpt-4o-mini)

| Item | Cálculo | Tokens/mês | Custo (US$/1M ≈ 4,50) |
|------|---------|------------|------------------------|
| 3 usuários × uso moderado | 3 × 375.000 | 1.125.000 | ~US$ 5,06 |
| Portal análise de pele | 60 × 3.000 | 180.000 | ~US$ 0,81 |
| OCR parse (gpt-4o-mini) | 20 × 800 | 16.000 | ~US$ 0,03 |
| **Subtotal OpenAI** | | **1.321.000** | **~US$ 5,90** |

Em reais (câmbio ~R$ 5,80): **~R$ 34/mês**.

### 2.2 Supabase

- **Free tier**: 500 MB DB, 1 GB storage, 50k MAU. Para 1 clínica, 3 usuários e dezenas de clientes, costuma caber no free.
- **Se passar**: Pro = US$ 25/mês (~R$ 145).

**Cenário base:** R$ 0 (free). **Cenário crescimento:** R$ 145.

### 2.3 Google Cloud Vision (OCR)

- 20 imagens/mês → dentro das 1.000 grátis. **R$ 0**.

Se no futuro subir para 150 imagens/mês: ainda free. Só paga se passar de 1.000/mês.

### 2.4 Hosting (servidor Node)

- **Railway / Render / Fly.io**: free tier limitado ou ~US$ 5–7/mês.
- **VPS (ex.: R$ 20–40/mês)**: suficiente para um Node + baixo tráfego.

**Estimativa:** **R$ 30–50/mês** (ou US$ 5–7).

### 2.5 Resumo do cenário base (1 clínica)

| Item | Valor (R$/mês) |
|------|----------------|
| OpenAI | 34 |
| Supabase | 0 (free) |
| Google Vision | 0 |
| Hosting | 30–50 |
| **Total base** | **R$ 64–84/mês** |

Em dólar: **~US$ 11–15/mês** por clínica nesse uso.

---

## 3. Margem de erro recomendada

Para **não tomar prejuízo** e cobrir:

- pico de uso (mais perguntas no Copilot, mais análises de pele),
- variação de câmbio (OpenAI em US$),
- crescimento de dados (Supabase),
- algum uso acima do “moderado”,

uma margem de **1,4x a 1,5x** em cima do custo base é razoável.

- Custo base: **R$ 64–84**
- Com margem 1,45x: **R$ 93–122/mês**

Ou seja: **cobrar no mínimo R$ 95–120/mês por clínica** (dependendo de você usar free tier de hosting ou não) cobre custos e dá folga.

---

## 4. Preço sugerido para não ter prejuízo

| Cenário | Custo real (R$/mês) | Com margem 1,45x | Preço mínimo sugerido por clínica |
|---------|----------------------|------------------|-----------------------------------|
| 1 clínica, Supabase free, hosting barato | 64–84 | 93–122 | **R$ 97–127/mês** |
| 1 clínica, Supabase Pro, hosting estável | 179–199 | 260–289 | **R$ 260–290/mês** |

Recomendações práticas:

- **Plano “entrada” (1 clínica, uso moderado):** cobrar **no mínimo R$ 99–129/mês**. Assim você cobre custos e tem margem.
- **Se oferecer múltiplas clínicas no mesmo tenant:** custo sobe principalmente por OpenAI (mais usuários + mais análises). Use a tabela abaixo e mantenha a mesma margem (1,4x–1,5x).

---

## 5. Várias clínicas (escala)

Custo de **OpenAI** escala com usuários e com análises de pele; **Supabase** e **hosting** podem ser compartilhados (um backend para todas as orgs).

Exemplo: **5 clínicas**, média 3 usuários cada, mesmo uso moderado + 60 análises portal por clínica.

| Item | Cálculo | R$/mês (aprox.) |
|------|---------|------------------|
| OpenAI | 5 × (1.125k + 180k) tokens ≈ 6,5M tokens | ~R$ 170 |
| Supabase | Provável Pro (mais dados) | R$ 145 |
| Vision | 5 × 20 = 100 imagens | R$ 0 |
| Hosting | Mesmo servidor, um pouco mais robusto | R$ 50–70 |
| **Total** | | **R$ 365–385** |
| Com margem 1,45x | | **R$ 530–560** |

Preço mínimo para 5 clínicas (sem prejuízo): **R$ 530–560/mês** no total, ou **R$ 106–112 por clínica** (se dividir igual). Na prática, pode cobrar **R$ 110–130/clínica** e manter margem.

---

## 6. Tabela resumo — preço mínimo por clínica (sem prejuízo)

| Situação | Custo/mês (R$) | Com margem ~1,45x | Cobrar no mínimo (R$/clínica) |
|----------|----------------|-------------------|-------------------------------|
| 1 clínica, free tier Supabase | 64–84 | 93–122 | **R$ 97–127** |
| 1 clínica, Supabase Pro | 179–199 | 260–289 | **R$ 260–290** |
| 5 clínicas (custo total) | 365–385 | 530–560 | **R$ 106–112/clínica** |
| 10 clínicas (custo total) | ~700–750 | ~1.015–1.090 | **R$ 102–109/clínica** |

Margem de erro está na faixa de **40–45%** em cima do custo; se o uso for menor que o estimado, sobra margem; se for maior, reduz o risco de prejuízo.

---

## 7. O que pode fazer o custo subir (e como se proteger)

1. **Copilot usado demais** (muitas perguntas/dia por usuário) → limite de perguntas por usuário/dia ou plano “premium” com cota maior.
2. **Análise de pele no portal** com muitas fotos por envio ou muitos envios → limitar fotos por análise e/ou número de análises por clínica/mês.
3. **Supabase** passar do free (muitos usuários, muito storage) → migrar para Pro e incluir no preço (ex.: plano “crescimento”).
4. **Câmbio** (OpenAI em dólar) → preço em R$ com margem 1,45x já absorve parte; pode repassar reajuste anual “por índice + custo de API”.

---

## 8. Número único para guardar

Para **uma clínica**, uso **realista** (3 usuários, uso moderado, análises de pele no portal):

- **Gasto estimado:** **R$ 64–84/mês** (Supabase free, hosting barato).
- **Para não ter prejuízo e ter margem:** cobrar **no mínimo R$ 97–127/mês** por clínica (arredondar para **R$ 99–129/mês**).

Assim você cobre custos, margem de erro e ainda tem folga se o uso for um pouco maior que o previsto.
