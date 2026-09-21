# Motor de custos e precificação — 2026

**Regra:** nunca alterar `valor_cobrado` automaticamente. IA explica. Humano confirma.

## O que já existe

- Procedimento: `custo_material_estimado`, `margem_minima_desejada`, `comissao_profissional_pct`, `duration_minutes`, `valor_cobrado` (`procedimentos.service.js`).  
- Org: taxas à vista/parcelado/bandeira, `margem_alvo_padrao_pct`.  
- `procedure_stock_usage` (consumo médio cadastrado).  
- Consumo ao aplicar (trigger).  
- Histórico de custo em `estoque_entradas`.  
- Alerta ≥15% (`estoque.custo_aumentou`) **sem** lista de procedimentos.  
- `/api/preco` rascunho.  
- Simulador de parcelas na UI de taxas.  
- Custos fixos → lançamentos no `financeiro` (não rateio).

## Motor alvo (P1)

```
material_real     = Σ (consumo do protocolo × custo lote vigente)  // fallback: estimado
mao_de_obra       = f(team_payment_models, duração)
comissao          = % sobre preço simulado (iterar)
estrutural        = rateio configurável (hora | atendimento | sala | capacidade | não ratear)
taxa              = política da org sobre o preço
inadimplencia     = só se % configurada
custo_total       = soma
preço_eq          = custo_total
preço_mín         = custo_total / (1 − margem_mínima)
preço_rec         = custo_total / (1 − margem_alvo)
preço_premium     = posicionamento interno (não “o mercado”)
lucro             = preço − custo
lucro_hora        = lucro / (duração/60)
```

Explicação componente a componente na UI. Faltou dado → “não informado”.

## Simuladores (“e se”)

+10% preço, +20% insumo, −10% desconto, 10x, −tempo, +volume. Todos **cenários**, copy canônica de desconto (não “dê X%”).

## Margem em risco (completar)

Hoje: “N produtos subiram.”  
Alvo: procedimentos afetados via `protocolos_descartaveis` / `procedure_stock_usage` / consumo; margem antes/depois; impacto mensal ≈ consumo recente × Δcusto.

## Custos fixos

Metodologia **por rubrica**. Proibido ÷ atendimentos como único modo. Mostrar método no card do procedimento.

## Market Radar

Fora deste motor. Ver `MARKET-RADAR-2026.md`.
