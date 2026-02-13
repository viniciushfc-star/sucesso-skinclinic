# Como o sistema trata: quanto cobrar, desconto e parcelamento

Enquanto a **API de pagamento (banco/operadora) não está integrada**, o app não calcula taxas reais nem aplica regras da operadora. Este doc resume o que existe hoje e onde ficam as regras em standby.

---

## Hoje no sistema

| Tema | O que existe | O que não existe |
|------|----------------|------------------|
| **Quanto cobrar** | **`valor_cobrado`** por procedimento (cadastro manual em Procedimentos). Opcional: IA de precificação (`/api/preco`) sugere preço mínimo e ideal a partir de custos e mercado. | Nenhuma regra “valor mínimo/máximo” por tipo de pagamento; nada vindo da operadora. |
| **Desconto** | Nada: não há campo de desconto (%) nem cálculo de “valor com desconto” em cobrança. | Regra de “desconto máximo” ou “desconto permitido” por procedimento/cliente. |
| **Parcelamento** | A IA de preço pode devolver uma **sugestão de parcelamento** em texto (ex.: “até 6x sem juros”). | Nenhuma regra fixa do tipo “máximo X parcelas” nem “taxa por parcela”; nada vindo da operadora. |
| **Taxas (da clínica)** | Não há uso de taxa da operadora no fluxo de cobrança. O Financeiro registra valores que você lança; não há “desconto automático da taxa” no valor exibido. | Cálculo de “líquido após taxa” ou “taxa estimada” antes de integrar a API. |

Ou seja: **sem a API do banco**, o sistema não “pensa” em taxa da operadora, nem em limite de parcelas, nem em desconto máximo — só em **valor a cobrar** (manual ou sugestão da IA) e texto de parcelamento sugerido pela IA.

---

## Regras em standby (até integrar a API)

Para o dia em que a tela de pagamento/cobrança for ativada e a API ainda não estiver pronta, o app pode usar **valores padrão** definidos em um único lugar:

- **Arquivo:** `js/core/pagamento-regras.js` — constantes `PARCELAS_MAXIMAS`, `TAXA_OPERADORA_ESTIMADA_PCT`, `DESCONTO_MAXIMO_PCT` e funções `valorLiquidoEstimado`, `aplicarDescontoMaximo`.
- **Uso:** a tela Pagamento pelo app (e qualquer fluxo de cobrança futuro) lê daí para: “até X parcelas”, “taxa estimada Y%” (informativo), “desconto máximo Z%”. A tela Pagamento (quando ativada) exibe esse bloco em “Enquanto a API da operadora não está integrada”.

Quando a API do banco estiver integrada, essas regras passam a vir da **resposta da API** (ou da config por operadora), e o `pagamento-regras.js` vira fallback ou é substituído.

Resumo do que fica em **standby** até a integração:

- Quanto cobrar: continua sendo **valor do procedimento** (e/ou sugestão da IA); não há “valor com taxa” automático.
- Desconto: **regra padrão** (ex.: desconto máximo 10%) no `pagamento-regras.js` para a UI usar quando existir tela de cobrança.
- Parcelamento: **regra padrão** (ex.: até 12x) no mesmo arquivo; a UI pode mostrar “até Nx” e, depois, a API define o real.
- Taxas: **não** incluídas no valor cobrado ao cliente; quando quiser mostrar “sua taxa estimada” para a clínica, usa o percentual do `pagamento-regras.js` até a API responder com a taxa real.

Assim, o sistema “pensa” em cobrança/desconto/parcelamento de forma consistente em um só lugar, mesmo sem a API do banco, e quando integrar é só trocar a origem das regras (API em vez de constante).
