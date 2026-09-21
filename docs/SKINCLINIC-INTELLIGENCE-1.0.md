# SkinClinic Intelligence 1.0

**Data:** 2026-09-20  
**Estado:** AUSENTE como produto. Peças: Copiloto, notificações, cockpit, `ai_usage_events`.

---

## Princípio

A IA observa, cruza, calcula, explica, sugere, alerta, simula, prevê **cenários**.  
Não manda na clínica. Não dispara ação (mensagem, preço, desconto) sem humano + configuração.

Copilot canônico (`.cursor/rules/copilot-canon.mdc`) continua válido para **explicar dados internos**. Intelligence é a camada de **consolidação operacional**, não um segundo chat.

---

## Eventos observados (alvo)

Novo agendamento, atendimento concluído, cancelamento, falta, pagamento, procedimento realizado, estoque/custo alterado, paciente sem retorno, margem alterada, meta atingida/em risco, ocupação.

A IA **não** responde a cada evento. Agrega janelas: hoje, 7d, 28d.

## Insights (exemplos de tom)

- “Hoje a clínica registrou 8 atendimentos.”  
- “O faturamento desta semana está 12% acima da média das últimas 4 semanas (estimativa).”  
- “Dois procedimentos tiveram queda de margem após variação de custo de insumo.”  
- “7 pacientes estão fora do intervalo habitual de retorno (quando há histórico suficiente).”  

Proibido: “Decisão recomendada”, “você deve cobrar X”, diagnóstico clínico.

## Superfícies

1. Dashboard — bloco Atenção / Oportunidades (cockpit já é o esqueleto).  
2. Notificações — só o que exige ação humana, com teto diário.  
3. Copiloto — explica o **porquê** do card, não substitui o card.

Anti-spam: um insight por tema por dia; merge se o mesmo procedimento.

## Dados

Só tabelas da org. Sem inventar concorrente. Sem misturar Market Radar no mesmo card.

## Logs

Prompt/resposta resumidos em `ai_usage_events`. Sem tokens, fotos clínicas, CPF nos logs.

## Prioridade

P2. O cockpit atual já entrega “o que olhar agora” sem LLM. Intelligence entra quando custo/retorno forem verdadeiros.
