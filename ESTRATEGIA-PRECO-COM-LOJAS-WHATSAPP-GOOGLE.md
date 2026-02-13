# Estratégia de preço: lojas (Apple/Google), WhatsApp, Google e margem 65%

Objetivo: manter **~65% de margem** por usuário pagante considerando **todos** os custos reais: APIs (OpenAI, Google), **comissão das lojas** (App Store e Google Play), **WhatsApp** e infra (Supabase, hosting), sem fugir do **valor real de mercado** para SaaS de clínicas no Brasil.

---

## 1. Todos os custos que entram na conta

| Camada | O que é | Como cobra | Faixa (1 clínica, 3 users) |
|--------|---------|------------|-----------------------------|
| **OpenAI** | Copilot, Marketing, Preço, Estoque, Estudo de caso, Pele, Skincare, Análise de pele, OCR (parse) | Por token | R$ 13–20/mês (com limites e gpt-4o-mini onde possível) |
| **Google** | Vision (OCR), Calendar API | Vision: 1.000/mês grátis; depois ~US$ 1,50/1.000. Calendar: cota gratuita | R$ 0–5/mês (até ~100 OCRs) |
| **WhatsApp** | Mensagens (lembretes, confirmações, campanhas) | Por conversa (thread 24h). Utility ~US$ 0,008; Marketing ~US$ 0,0625; Service (cliente inicia) grátis | R$ 15–50/mês conforme volume |
| **Apple App Store** | Venda/assinatura no app iOS | 30% ano 1; 15% após 12 meses. Small Business (&lt; US$ 1M/ano): 15% | 15–30% do valor pago pelo cliente |
| **Google Play** | Venda/assinatura no app Android | 15% em assinaturas (desde o 1º ano) | 15% do valor pago pelo cliente |
| **Supabase** | Banco, Auth, Storage | Free até limite; Pro ~US$ 25 | R$ 0 ou R$ 145 |
| **Hosting** | Servidor Node (APIs) | VPS / Railway / Render | R$ 30–50 |

---

## 2. Comissão das lojas: o que sobra para você

O cliente paga, por exemplo, **R$ 59/mês**. Quem recebe primeiro é a loja; ela repassa a você depois de descontar a comissão.

| Canal de venda | Comissão típica | Você recebe (por R$ 59) |
|----------------|-----------------|---------------------------|
| **Google Play** (assinatura) | 15% | **R$ 50,15** |
| **Apple App Store** (1º ano) | 30% | **R$ 41,30** |
| **Apple App Store** (após 12 meses ou Small Business) | 15% | **R$ 50,15** |
| **Venda direta (site, PIX, boleto)** | 0% (só taxa do gateway, ex. 2–4%) | **~R$ 56–58** |

Ou seja: **o “valor real de mercado” que o cliente paga (ex.: R$ 59) não é a sua receita** quando a venda é pelo app. Sua **receita líquida** é o que sobra depois da loja (e, se for direto, depois do gateway).

---

## 3. Custo total real por clínica (com limites de uso)

Premissas: 1 clínica, 3 usuários, limites do doc **MARGEM-65-REDUCAO-USO** (Copilot 25/user, portal 40 análises, Pele 15/user, gpt-4o-mini onde possível).

| Item | R$/mês |
|------|--------|
| OpenAI | 13–20 |
| Google (Vision + Calendar) | 0–5 |
| WhatsApp (ex.: 80 conversas utility + 20 marketing) | 15–40 |
| Supabase | 0 (free) |
| Hosting | 30–50 |
| **Total custo operacional** | **R$ 58–115** |

Para margem 65%, o **custo máximo** deve ser **35% da receita que você efetivamente recebe** (após loja/gateway).

---

## 4. Estratégia em 4 pilares

### 4.1 Preço “de vitrine” alinhado ao mercado

Para SaaS de gestão de clínicas (agenda, financeiro, prontuário, IA) no Brasil, a faixa por **usuário/mês** costuma ser:

- **Entrada:** R$ 49–69/usuário  
- **Intermediário:** R$ 79–99/usuário  
- **Premium:** R$ 119–159/usuário  

Por **clínica** (plano “clínica pequena”): R$ 99–199/mês é comum.  
Sugestão: definir um **preço de lista** nessa faixa (ex.: **R$ 69/usuário/mês** ou **R$ 179/clínica até 3 usuários**) para não fugir do valor real de mercado.

### 4.2 Ajuste por canal: loja vs direto

- **Venda nas lojas (Apple/Google)**  
  - A receita que importa para a margem é a **líquida** (após 15–30%).  
  - Duas opções:  
    - **Mesmo preço do site:** ex. R$ 69 no app também. Você aceita margem menor na venda pelo app (ex.: ~55–60% quando 30% da Apple) e compensa com volume ou com direto.  
    - **Preço um pouco maior no app:** ex. R$ 79 no app e R$ 69 no site. Assim, após 30% Apple, você recebe 79 × 0,70 = R$ 55,30; após 15% Google, 79 × 0,85 = R$ 67,15. Ajuda a manter margem mesmo com comissão.

- **Venda direta (site, PIX, boleto, cartão)**  
  - Sem comissão de loja; só taxa do gateway (2–4%).  
  - Aqui a margem 65% é mais fácil. Vale **incentivar** assinatura pelo site (ex.: “Pague pelo site e ganhe R$ 10 de desconto no primeiro mês”).

### 4.3 Controle de custos variáveis (WhatsApp e Google)

- **WhatsApp**  
  - Use **Utility** para lembretes e confirmações (mais barato).  
  - Use **Marketing** só para campanhas/promoções; limitar quantidade no plano base (ex.: X campanhas/mês).  
  - Incluir no plano base um **número de conversas incluídas** (ex.: 80 utility + 10 marketing); acima disso, pacote extra ou upgrade de plano. Assim o custo por clínica fica previsível (ex.: R$ 15–35/mês na média).

- **Google**  
  - Vision: até ~100–200 OCRs/mês costuma caber no free tier. Se passar, limitar OCRs no plano ou cobrar extra.  
  - Calendar: manter uso dentro da cota gratuita.

Com isso, você mantém **Google + WhatsApp** em uma faixa que não estoura o teto de custo (35% da receita líquida).

### 4.4 Meta de margem sobre a **receita líquida**

- **Receita líquida** = valor que você realmente recebe (após loja ou após gateway no direto).  
- **Margem 65%** ⇒ Custo total ≤ **35% da receita líquida**.  
- Exemplo: 3 usuários, **R$ 69/usuário** no **site** (receita bruta R$ 207; líquida ~R$ 200).  
  - Custo máximo para 65%: 0,35 × 200 = **R$ 70**.  
  - Com custo operacional em **R$ 58–65** (OpenAI + WhatsApp + Google + hosting, com limites), você fica na margem desejada.

Se a venda for **100% pelo app** com 30% Apple no primeiro ano:  
- Receita líquida = 207 × 0,70 = **R$ 144,90**.  
- Custo máximo para 65% = 0,35 × 144,90 = **R$ 50,70**.  
- Aí é preciso **reduzir mais custo** (limites mais rígidos, menos conversas WhatsApp incluídas) ou **aumentar preço no app** (ex.: R$ 79/usuário no app) para a receita líquida subir e o mesmo custo caber em 35%.

---

## 5. Tabela de cenários (3 usuários por clínica)

Preço de lista: **R$ 69/usuário/mês** (receita bruta R$ 207).

| Cenário | Receita líquida (após loja/gateway) | Custo operacional (meta) | Margem (meta) |
|---------|-------------------------------------|---------------------------|---------------|
| 100% venda **direta** (site), gateway ~3% | ~R$ 201 | ≤ R$ 70 | 65% |
| 100% **Google Play** (15%) | ~R$ 176 | ≤ R$ 61,60 | 65% |
| 100% **Apple** (30% 1º ano) | ~R$ 145 | ≤ R$ 50,75 | 65% |
| Mix 50% direto + 50% Google | ~R$ 188 | ≤ R$ 65,80 | 65% |

Conclusão:  
- **Venda direta** e **Google Play** são os cenários onde manter 65% é mais tranquilo com custo na faixa **R$ 58–65**.  
- **Apple 30%** exige custo mais baixo (≤ R$ 51) ou **preço maior no app** (ex.: R$ 79/usuário no iOS → receita líquida 207 × 0,70 ≈ R$ 145 mantém; se você subir preço só no iOS para R$ 85, receita líquida sobe e o mesmo custo R$ 58–65 entra em 35%).

---

## 6. Ações práticas recomendadas

1. **Preço de mercado**  
   - Manter preço de lista na faixa **R$ 59–79/usuário** (ou equivalente por clínica), conforme posicionamento (entrada vs premium).

2. **Lojas**  
   - **Google Play:** preço igual ou até **R$ 5–10 a mais** que o site; 15% de comissão deixa margem viável.  
   - **Apple:** no 1º ano (30%), considerar **preço no app R$ 10–15 acima do site** (ex.: R$ 79 no iOS, R$ 69 no site) para compensar parte da comissão; ou aceitar margem um pouco menor no iOS no primeiro ano.

3. **Incentivo ao direto**  
   - “Assine pelo site e pague com PIX/boleto: desconto de R$ 10 no 1º mês” ou “preço promocional só no site.”  
   - Objetivo: aumentar a fatia de receita que não passa pela comissão das lojas.

4. **WhatsApp**  
   - Definir **cota incluída no plano** (ex.: 80 conversas utility + 10 marketing).  
   - Acima disso: pacote extra ou mensagem “Limite de mensagens do plano atingido.”  
   - Priorizar mensagens **Utility** (lembretes/confirmações) e limitar **Marketing** para controlar custo.

5. **Google**  
   - Manter OCR e Calendar dentro da cota gratuita; se crescer uso, limitar OCRs no plano ou cobrar pacote extra.

6. **Custos de IA e infra**  
   - Manter os **limites e o uso de gpt-4o-mini** do doc **MARGEM-65-REDUCAO-USO**, para custo operacional ficar na faixa **R$ 58–65** por clínica (3 users) e caber no teto de 35% da receita líquida na maioria dos cenários.

---

## 7. Resumo em uma frase

**Preço na faixa real de mercado (ex.: R$ 69/usuário), venda direta e Google Play como canais “amigos” da margem 65%; Apple com preço um pouco maior no app ou margem um pouco menor no 1º ano; WhatsApp e Google com cota incluída no plano e limite acima disso; custo total (OpenAI + WhatsApp + Google + infra) ≤ 35% da receita líquida (após loja ou gateway).**

Assim você mantém a média de margem que quer, sem fugir do valor real de mercado e considerando custo com Google, WhatsApp e comissão por venda no app (Google e Apple).
