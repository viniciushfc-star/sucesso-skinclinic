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

## P2-4 — plano na agenda + RPC portal + Storage IDOR

- Novo agendamento: escolher plano terapêutico; primeira sessão neste horário; demais a cada 7 dias (mesmo horário) se a caixa estiver marcada. Conflito de sala/profissional **pula** a sessão.
- Colunas `agenda.plano_id`, `sessao_plano`, `sessoes_plano`. SQL: `supabase/migrations/20260922010000_p2_plano_agenda_portal_storage.sql`.
- Recria `get_client_session_by_token` / `get_client_by_token` com **hash** (`p_token`) e `get_analises_pele_by_token` só do cliente da sessão (sem `ia_preliminar`).
- Buckets `client-photos`, `anamnese-fotos`, `analise-pele-fotos` privados; SELECT/INSERT só se o primeiro segmento do path for `org_id` do membro. Assinatura de URL no app recusa path de outra org.

## P2-5 — Marketing Intelligence

Marketing: até 3 campanhas a partir do radar/espera. Objetivo, público, custo em **tempo de contato** (não inventa R$ de mídia), métrica, prazo, risco, como medir. WhatsApp só na fila do CRM. Sem Market Radar. Sem garantia de resultado. Copilot de conteúdo continua opcional.

## P2-6 — Minha jornada no portal

`portal.html` abre em **Minha jornada**: cadastro, anamnese, pele (só validada), sessões, skincare se liberado, próximo passo. Sem `ia_preliminar`. SQL: `supabase/migrations/20260922020000_p2_portal_jornada.sql` (`list_portal_jornada_agenda`). Sem o SQL, usa os horários futuros já existentes.

## P2-7 — lucro/hora

Procedimentos: ordenar por lucro/hora; faixa melhor/pior na lista. Cockpit **Mês** e Oportunidades usam a mesma estimativa (preço − material estimado ÷ duração). **Não altera preço.** Sem preço ou duração → “não informado”.
