# Arquitetura SkinClinic Intelligence — 2026

**Estado:** AUSENTE como produto. Sensores parciais: cockpit, `getMargemEmRisco`, CRM inativos, Copiloto chat, N rotas `/api/*`.

## Princípio

Uma camada. Vários sensores. Zero spam.  
IA observa e explica. Humano age.

Não criar o 8º copiloto. O Copilot canônico (`copilot-canon.mdc`) permanece para **narrar dados internos**. Intelligence **escolhe o que merece atenção**.

## Sensores (dados existentes)

| Sensor | Fonte hoje |
|--------|------------|
| Agenda do dia | `listAppointmentsByDate` + `cockpit-status` |
| Ociosidade | células vazias da grade (cálculo a fazer) |
| No-show / atraso | status agenda |
| Inativos | `listInactiveClients` |
| Espera | `agenda_waitlist` |
| Pele pendente | `analise_pele` pending_validation |
| Contas | `contas_a_pagar` |
| Custo insumo | `audit_logs` `estoque.custo_aumentou` |
| Receita | `financeiro` |
| Aplicados | `protocolos_aplicados` |
| Consumo | `estoque_consumo` |
| Metas | `financeiro_metas` (fraco) |

## Insights possíveis (só com dado)

- “Hoje há N atendimentos; M em atraso.” (cockpit já aproxima)  
- “Há N clientes sem visita há ≥90 dias.”  
- “K produtos subiram ≥15% de custo (30d).” — **não** ainda “procedimento X margem −12%”  
- “Waitlist com N pessoas.”  
- “N análises de pele aguardam validação.”  

**Ainda não honestos:** lucro/hora, ritmo vs meta, R$ parado em validade, 7 horários ociosos — falta cálculo explícito na grade/estoque validade.

## Priorização (anti-spam)

Score: impacto financeiro estimado × urgência × acionabilidade.  
Teto: 5 cards Atenção/dia. Merge por tema.  
Notificação só se exigir ação nas próximas 24h.

## Superfícies

1. Dashboard cockpit (já)  
2. Copilot “por que este card?”  
3. Notificações com teto  

## Logs

`ai_usage_events`. Sem CPF, foto, token.

## Prioridade

P2 depois do grafo custo (P1). O cockpit P1 já entrega valor sem LLM.
