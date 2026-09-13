# Cenário 80% de lucro: preço competitivo com IA limitada ou sem Copilot

Objetivo: **manter preço competitivo** (R$ 59–69/usuário) e chegar em **~80% de margem** (custo = 20% da receita). Isso exige cortar custo de IA de forma forte — em especial **limitar muito a IA ou tirar o Copilot** do plano base.

---

## 1. A matemática dos 80%

- **Margem 80%** ⇒ **Custo = 20% da receita**
- Exemplo: 3 usuários × R$ 69 = **R$ 207** receita (direto) ⇒ custo máximo = **R$ 41,40**
- Com venda no app (Apple 30%): receita líquida ≈ R$ 145 ⇒ custo máximo = **R$ 29**

Hoje, com IA “controlada” (Copilot + limites), o custo por clínica está na faixa **R$ 50–60** (OpenAI + WhatsApp + Google + hosting). Para cair para **R$ 38–42** e atingir 80% de margem no preço competitivo, é preciso **reduzir bem o uso de IA** ou **tirar o Copilot** do plano base.

---

## 2. Onde está o custo hoje (referência 65%)

| Item | R$/mês (1 clínica, 3 users) |
|------|-----------------------------|
| Copilot (25/user, contexto reduzido) | ~6,85 |
| Portal análise de pele (40 envios) | ~3,13 |
| Pele (15/user) | ~2,94 |
| Demais IAs (mini) | ~0,18 |
| **Subtotal OpenAI** | **~13** |
| WhatsApp (cota média) | 15–40 |
| Google | 0–5 |
| Hosting | 30–50 |
| **Total** | **~55–65** |

Para **80% de margem** com receita R$ 207, o **total** precisa ser **≤ R$ 41**. Ou seja, cortar **~R$ 18–22**.

---

## 3. “Mundo 1”: Sem Copilot no plano base (IA leve)

**Ideia:** Plano base **competitivo em preço** (R$ 59–69/usuário), **sem Copilot**. Quem quiser Copilot paga add-on (ex.: +R$ 15–20/usuário). Assim o custo do plano base cai e a margem sobe.

### O que fazer

| Item | Ação | Economia (R$/mês) |
|------|------|-------------------|
| **Copilot** | **Fora do plano base** (ou add-on pago) | ~7 |
| **Portal análise de pele** | Limite **10 envios/clínica/mês** (ou add-on) | ~2 |
| **Pele** (dashboard) | **0** no base, ou 2/usuário/mês | ~3 |
| **Demais IAs** | Manter em **gpt-4o-mini**, poucas chamadas (ex.: 5/user/mês cada) | já baixo |
| **WhatsApp** | Cota mínima: **20–30 conversas utility** (só lembretes/confirmações) | ~15–20 |
| **Hosting** | Manter no mínimo (R$ 30) | — |

### Custo estimado do plano base (sem Copilot)

| Item | R$/mês |
|------|--------|
| OpenAI (portal 10 + Pele 0 + demais mini) | ~1–2 |
| WhatsApp (20–30 utility) | ~8–12 |
| Google | 0 |
| Hosting | 30 |
| **Total** | **~39–44** |

Com **R$ 207** de receita (3 × R$ 69): custo R$ 41 ⇒ **margem ≈ 80%**.

Conclusão: **tirar o Copilot do plano base** (e limitar bem portal + Pele + WhatsApp) permite **preço competitivo** e **~80% de lucro** no plano base. Copilot vira **add-on** (ex.: +R$ 15–20/usuário) para quem quiser, com margem menor nesse add-on ou preço que compense.

---

## 4. “Mundo 2”: Copilot bem limitado (não zero)

**Ideia:** Manter Copilot no plano, mas **bem limitado**, e cortar o resto ao máximo.

### O que fazer

| Item | Ação | Efeito |
|------|------|--------|
| **Copilot** | **5 perguntas/usuário/mês** (ou 1/semana) | Custo cai de ~R$ 7 para ~R$ 1,40 |
| **Portal análise de pele** | **5 envios/clínica/mês** ou só add-on | ~R$ 0,40 |
| **Pele** | **0** no base | economiza ~R$ 3 |
| **WhatsApp** | **15–20 conversas utility** | ~R$ 8 |
| **Demais IAs** | Só **mini**, poucas chamadas | ~R$ 0,20 |
| **Hosting** | R$ 30 | — |

### Custo estimado

| Item | R$/mês |
|------|--------|
| OpenAI (Copilot 5/user + portal 5 + mini) | ~2,5 |
| WhatsApp | ~8 |
| Hosting | 30 |
| **Total** | **~40–41** |

De novo: **receita R$ 207, custo ~R$ 41 ⇒ margem ~80%**, com preço competitivo e **Copilot “simbólico”** (5 perguntas/usuário/mês).

---

## 5. “Mundo 3”: Sem nenhuma IA com visão (sem Copilot, sem Pele, sem análise de pele no portal)

**Ideia:** Plano base **só gestão + IAs baratas** (Preço, Estoque, Marketing, Estudo de caso, etc. em **gpt-4o-mini** com limite baixo). Sem Copilot, sem Pele, sem análise de pele no portal. Essas três podem ser **add-ons** pagos.

### Custo estimado

| Item | R$/mês |
|------|--------|
| OpenAI (só mini: Preço, Estoque, Marketing, etc. – ex.: 30 chamadas no total) | ~0,30 |
| WhatsApp (20 utility) | ~8 |
| Hosting | 30 |
| **Total** | **~38–39** |

Margem em cima de R$ 207: **~81%**. Preço continua competitivo; o diferencial “IA forte” fica nos add-ons (Copilot, Pele, Análise de pele no portal).

---

## 6. Resumo: três mundos para 80% de lucro

| Mundo | Copilot | Portal análise de pele | Pele (dashboard) | Outras IAs | Custo (R$/mês) | Margem (receita R$ 207) |
|-------|---------|-------------------------|-------------------|------------|----------------|--------------------------|
| **1 – Sem Copilot** | Fora (add-on) | 10/mês ou add-on | 0 ou 2/user | Mini, poucas | ~39–44 | **~80%** |
| **2 – Copilot limitado** | 5/user/mês | 5/mês | 0 | Mini, poucas | ~40–41 | **~80%** |
| **3 – Sem IA “cara”** | Add-on | Add-on | Add-on | Só mini, pouco | ~38–39 | **~81%** |

Em todos os mundos o **preço** pode ficar **competitivo** (R$ 59–69/usuário). A diferença é **quanto de IA** entra no plano base:

- **Mundo 1:** sem Copilot no base; resto limitado → **80% de lucro**, preço competitivo.
- **Mundo 2:** Copilot “simbólico” (5 perguntas/user/mês) → **80% de lucro**, preço competitivo.
- **Mundo 3:** só IAs baratas (mini); Copilot, Pele e análise de pele como add-ons → **~81% de lucro**, preço competitivo.

---

## 7. Como comunicar sem parecer “pior” que concorrente

- **Plano base:** “Gestão completa (agenda, financeiro, prontuário, WhatsApp) + ferramentas de IA para preço, estoque, marketing e estudo de caso.” Preço **R$ 59–69/usuário**.
- **Add-ons:**  
  - **“Copilot”** (perguntas ilimitadas ou 25/user): +R$ 15–20/usuário.  
  - **“Análise de pele no portal”** (X envios/mês): +R$ 10–15/clínica.  
  - **“Pele”** (análise com fotos no dashboard): +R$ 10/usuário ou pacote por clínica.

Assim você mantém **preço competitivo**, atinge **~80% de lucro** no plano base e ainda oferece IA forte para quem paga pelos add-ons.

---

## 8. Recomendações práticas

1. **Se o foco é 80% de margem e preço competitivo:** use o **Mundo 1** (sem Copilot no base) ou o **Mundo 2** (Copilot 5 perguntas/user/mês).  
2. **Se quiser o máximo de margem no base:** use o **Mundo 3** e venda Copilot, Pele e análise de pele como add-ons.  
3. **Sempre:** limite baixo de WhatsApp no base (ex.: 20–30 conversas utility), hosting enxuto (R$ 30) e **demais IAs só em gpt-4o-mini** com poucas chamadas.  
4. **Receita por loja:** se parte das vendas for Apple (30%), a receita líquida cai; aí ou você sobe um pouco o preço no app ou aceita margem um pouco menor nas vendas iOS (ex.: 75% em vez de 80%).

Resumo: **sim, existe mundo para manter preço competitivo, limitar IA ou tirar Copilot e chegar em ~80% de lucro:** plano base sem (ou com Copilot bem limitado) + portal e Pele limitados ou em add-on + WhatsApp mínimo + resto em mini.
