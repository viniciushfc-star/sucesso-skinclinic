# Market Radar SkinClinic 1.0

**Data:** 2026-09-20  
**Estado:** AUSENTE. **P2.** Sem fonte confiável, o módulo não aparece.

---

## O que é

Camada opcional de **referência externa** para precificação e posicionamento. Não é o Copilot. Não é diagnóstico. Não define o preço da clínica.

## Toda informação externa deve ter

- fonte  
- data  
- região  
- metodologia  
- nível de confiança  

Sem um desses campos → não exibir o número.

## Tom permitido

“Seu preço está abaixo/acima da **referência observada** (fonte X, região Y, data Z).”  
Explicar a faixa, não um ponto mágico.

## Tom proibido

“Cobre exatamente R$ X porque o mercado cobra isso.”  
Inventar concorrentes, tickets, tendências.

## Fontes aceitáveis (quando existirem)

Pesquisas próprias da clínica (tabela interna com fonte), bases licenciadas, dados públicos citados. Scraping opaco **não** entra no produto.

## Integração com o motor de preço

Radar é um **card ao lado** da simulação interna. O preço sugerido continua vindo do custo + margem da clínica. Radar só contextualiza.
