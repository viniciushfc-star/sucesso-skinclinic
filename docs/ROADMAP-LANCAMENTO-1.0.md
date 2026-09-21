# Roadmap de lançamento SkinClinic 1.0

**Data:** 2026-09-20  
**Regra:** P3 não começa com P0/P1 aberto. Não quebrar o que já opera. Consolidar, não duplicar.

**Status atual:** não READY FOR PILOT. Operação fechada possível.

---

## P0 — bloqueia segurança / lançamento

| ID | Item | Resultado esperado | Dependência |
|----|------|--------------------|-------------|
| P0-1 | Schema único: dump do projeto live + baseline `CREATE` nas migrations | `supabase db reset` local reproduz o app | Acesso ao projeto Supabase |
| P0-2 | Prova RLS ORG A / ORG B (tabelas + storage + RPC + export) | Relatório com queries e print | P0-1 |
| P0-3 | Consolidar `agenda` vs `appointments` | Uma tabela canônica; o outro vira view ou some | Mapa de quem chama |
| P0-4 | Fail-closed de catálogo de permissão em produção | Sem tabela → 500, não role | Decisão produto (conflito registrado) |
| P0-5 | Convite: fluxo único (token + email + role + aceite) | Sem self-join por UUID | Já parcialmente nas migrations |
| P0-6 | Tokens portal: migrar legado plaintext ou forçar re-emissão | Sem token em claro | Já hash+7d no código novo |
| P0-7 | E2E crítico: login, org, agenda, cliente, portal | CI verde contra staging | Ambiente |

## P1 — essencial para o produto (OS da clínica)

| ID | Item |
|----|------|
| P1-1 | Procedimento como P&L: material real + MO + taxa + margem explicada (sem auto-preço) |
| P1-2 | Custos fixos com metodologia configurável (não “÷ atendimentos” forçado) |
| P1-3 | Protocolo aplicado no atalho da agenda (canônico) |
| P1-4 | Impacto de insumo → procedimentos (alerta margem em risco) |
| P1-5 | Cockpit único: remover duplicata dos cards globais ou subordiná-los |
| P1-6 | Onboarding até primeiro atendimento + protocolo |
| P1-7 | Radar de retorno (atraso vs ritmo, pacote incompleto) — sem disparo automático |
| P1-8 | Permissões granulares alinhadas (recepção vs profissional) no backend |
| P1-9 | Observabilidade mínima: 5xx, custo IA, falha webhook |
| P1-10 | LGPD operacional: export/exclusão documentada + retenção |

## P2 — diferencial (depois de P0/P1)

SkinClinic Intelligence (insights, não spam). Metas com ritmo/projeção. Market Radar com fonte. Marketing Intelligence estruturado. Jornada do portal. Lucro/hora por procedimento. Dashboard Mês/Atenção/Oportunidades completo.

## P3 — futuro (bloqueado)

Gamificação XP/badges. Pagamento no app (`PAGAMENTO_APP_ENABLED`). Contabilidade interna. BI pesado. Dados de mercado sem fonte.

---

## Sequência de execução

1. Congelar schema (P0-1)  
2. Prova de isolamento (P0-2)  
3. Unificar agenda (P0-3)  
4. Fail-closed permissões (P0-4)  
5. Motor de custo/preço explicável (P1-1/2/4)  
6. UX da jornada (P1-3/5/6/7)  
7. Só então Intelligence (P2)

## Gates

**READY FOR PILOT:** P0-1 a P0-7 verdes + agenda/clientes/financeiro/estoque/portal/IA sem regressão.  
**READY FOR PUBLIC LAUNCH:** piloto real, custos IA conhecidos, UX validada, LGPD revisada, suporte, incidente runbook.

## O que não fazer nesta trilha

Novo módulo de gamificação. Novo menu. Segundo Copilot. Segunda tabela de agendamento. Auto-ajuste de preço. WhatsApp em massa sem consentimento.
