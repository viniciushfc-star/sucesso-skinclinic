# Fase 3 — P1 clientes + P&L de procedimento

**DATA:** 2026-09-21
**Escopo:** unificar cadastro legado `clientes` → `clients` sem perder linhas; P&L estimado do procedimento. Sem Intelligence (P2). Sem auto-preço.

## SQL (colar no Supabase)

Arquivo: `supabase/migrations/20260921150000_p1_merge_clientes_into_clients.sql`

- `clients.id` é **uuid**; `clientes.id` é **bigint** — não dá para copiar o mesmo id (`uuid = bigint`).
- Gera UUID novo e grava o id antigo em `clients.legacy_cliente_id`.
- Não insere se já houver `legacy_cliente_id`, e-mail ou telefone iguais na mesma org.
- **Não apaga** `clientes`.
- Telefone vazio vira `migrado` (constraint e-mail OU telefone).

Depois do SQL: `clients` deve passar de 4 para até 7 linhas. O app une as duas tabelas e **não duplica** quem já foi copiado.

## P1-4 — atalho da agenda

O botão do painel **registra nesta sessão** (modal), sem obrigar abrir o perfil. Ficha completa continua disponível. Descartáveis do protocolo entram no consumo estimado e **não bloqueiam** o atendimento.

## P1-2 — rateio de custo fixo

Financeiro → Custo fixo: escolher método (não ratear | hora | atendimento | sala | capacidade). Padrão **não ratear**. Sem horas/capacidade/lançamentos o P&L diz “não informado”. SQL: `supabase/migrations/20260921160000_p1_rateio_custo_fixo.sql`.

## P1-5 — cockpit

Cards globais do header saíram (não competem com “o que olhar agora”). Abas **Hoje** e **Mês** no dashboard. Gráficos continuam no bloco recolhido do fim.

## P1-6 — setup + CSV

No Hoje: barra “X% configurado” até o checklist (empresa, equipe, procedimento com preço, custo/estoque, cliente, agenda). 100% + primeiro protocolo aplicado some a barra. CSV em Exportar: prévia obrigatória, botão Importar só depois, sem gravar na leitura do arquivo.

## P1-7 — radar de retorno

No CRM: pacote sem próxima, nova sem 2º, atrasada vs ritmo pessoal (mediana, mín. 3 visitas), sem próxima sessão, inativa (dias configuráveis). Um sinal por pessoa. WhatsApp só no clique. Cockpit (Oportunidades) mostra o recorte. Agenda abre com o cliente pré-selecionado.

## P1-8 — papéis recepção e profissional

Permissão vale na **API** (`requirePermission` / mapa compartilhado), não só no menu.

- **Recepção:** agenda (ver/gerir), clientes (ver/gerir/editar), WhatsApp API. Sem financeiro, convite, backup, Copiloto, IA auxiliar, catálogo de procedimentos.
- **Profissional:** agenda, clientes (ver/editar, sem portal/CRM manage), planos, estoque, procedimentos, IA auxiliar. Sem financeiro, WhatsApp API, Copiloto, convite.
- **staff** continua = acesso limitado (`funcionario`: dashboard, agenda ver, clientes ver).
- Equipe → Convidar: Recepção | Profissional | Acesso limitado | Visualização.
- SQL CHECK: `supabase/migrations/20260921180000_p1_roles_recepcao_profissional.sql`. Sem o SQL o insert do convite pode falhar.

## App (já no código)

- `getClientes` / `getClientById` / agenda: une `clients` + linhas só em `clientes`.
- Métricas: contagem de IDs únicos nas duas tabelas.
- Editar procedimento: bloco P&L (material real se houver estoque, senão estimado; comissão; taxa à vista crédito; lucro/hora; preços sugeridos). **Não grava preço.**
- Card margem em risco: lista procedimentos que usam o produto.

## P1-9 — observabilidade

- 5xx das APIs: log `[API_5XX]` + linha em `api_error_events` (sem body/token).
- Pedido `/api/*` ≥ 4s: log `[API_SLOW]` (não grava).
- Webhook de transações: falha de insert, secret ausente ou conta inexistente → `[WEBHOOK_FAIL]`.
- Custo de IA: continua em `ai_usage_events`; Auditoria mostra o total do mês por feature.
- SQL: `supabase/migrations/20260921190000_p1_obs_5xx_ai.sql`.

## P1-10 — LGPD operacional

Perfil do cliente → Dados e privacidade: JSON do titular (sem `ia_preliminar`) e anonimização de identidade (`EXCLUIR`). **Prontuário permanece** (anamnese, fotos, o que foi feito, agenda, financeiro) para respaldo em intercorrência. Some nome/contato/CPF e o portal. SQL: `supabase/migrations/20260921200000_p1_lgpd_titular.sql`. Texto: `docs/LGPD-OPERACIONAL.md`. **Não é declaração de conformidade.**

## Fora deste passo

- Plano na agenda, RPC portal, Storage IDOR.

## P2-1 — Intelligence (priorizar)

Cockpit Atenção/Oportunidades: no máximo 5 temas por coluna, um card por tema, com o “por quê”. Sem LLM nesta fatia. Sem WhatsApp automático. Sem alterar preço. Clique abre agenda, CRM, financeiro, pele ou procedimentos.

## P2-2 — metas com ritmo

Receita/lucro mensal: realizado = lançamentos do `YYYY-MM`. Mostra % , restante, R$/dia atual, R$/dia necessário e projeção. Texto: **projeção, não garantia**. Sem XP. Reserva compara com saldo de caixa (sem ritmo diário). UI: Financeiro → Reserva e metas; recorte no cockpit **Mês**.

## P2-3 — WhatsApp na fila do CRM

CRM monta no máximo 15 contatos (uma pessoa, o sinal mais urgente). WhatsApp só no clique. Sem disparo da fila inteira. Pedido de avaliação também pega só a primeira da fila.
