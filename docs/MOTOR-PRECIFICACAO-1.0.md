# Motor de precificação SkinClinic 1.0

**Data:** 2026-09-20  
**Regra absoluta:** o sistema **nunca** altera o preço cobrado sozinho.

---

## 1. O que já existe (evidência)

- Cadastro: `valor_cobrado`, `custo_material_estimado`, `margem_minima_desejada`, `comissao_profissional_pct`, duração.  
- Org: taxas à vista/parcelado/bandeira, `margem_alvo_padrao_pct`.  
- UI de taxas + simulação de parcelas.  
- `/api/preco` — rascunho de IA, não persistência do preço.

Isso **não** é o motor completo. É um **estimador parcial**.

## 2. Custo total do procedimento (alvo)

```
custo_total =
  material_real            # consumo do protocolo × custo do lote vigente
+ mao_de_obra              # modelo de pagamento do profissional × tempo
+ comissao                 # se distinta da MO
+ custo_estrutural_rateado # ver metodologia abaixo
+ taxa_pagamento           # sobre o preço simulado (iterativo)
+ inadimplencia_esperada   # só se a clínica configurar %
```

**Material estimado** do cadastro é fallback quando não há consumo.

## 3. Saídas da simulação (todas rotuladas como estimativa)

| Saída | Uso |
|-------|-----|
| Preço mínimo viável | Cobre custo + margem mínima |
| Preço de equilíbrio | Cobre custo, margem ~0 |
| Preço recomendado | Custo / (1 − margem alvo) |
| Preço premium | Posicionamento; nunca “o mercado cobra X” |
| Lucro R$ e R$/hora | Receita − custo; ÷ duração |
| Simulação desconto/parcela | Impacto na margem; usuário escolhe o cenário |

## 4. Explicação obrigatória (UI)

Cada sugestão lista componentes:

```
Material: R$ …
Mão de obra: R$ …
Custo estrutural: R$ … (método: hora | atendimento | sala | capacidade)
Comissão: R$ …
Taxa de pagamento: R$ …
Custo total: R$ …
Margem alvo: …%
Preço sugerido: R$ …
```

Sem fonte de dado → o componente some ou diz “não informado”, **nunca inventa**.

## 5. Custos fixos — metodologia configurável

A clínica escolhe, por rubrica (aluguel, software, salário…):

- **mensal da clínica** (não rateado); e/ou  
- **rateio** por: hora disponível, atendimento realizado, procedimento, profissional, sala, capacidade teórica.

O sistema mostra “custo estrutural estimado deste procedimento” com o **método visível**. Proibido dividir tudo por nº de atendimentos sem configuração.

## 6. Alerta “MARGEM EM RISCO”

Quando o custo unitário de um insumo sobe:

- listar procedimentos/protocolos que consomem o item;  
- custo anterior vs atual; variação %; margem anterior vs atual;  
- **não** mudar `valor_cobrado`.

## 7. Market Radar (módulo separado)

Não entra no Copilot clínico. Ver `docs/MARKET-RADAR-1.0.md`. Sem dado confiável → o motor usa só dados internos.

## 8. Prioridade

P1 depois do schema reproduzível. Sem lote + consumo, o “custo real” mente — preferir rótulo “estimado”.
