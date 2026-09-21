# Roadmap de implementação — 2026

Classificação: impacto + risco + dependência + valor para a clínica. **Não** por facilidade. P3 bloqueado com P0/P1 aberto. **Não quebrar** o que opera. Consolidar duplicatas.

A sequência sugerida no briefing foi **validada com ajustes**: o core operacional **já existe** — Fases 2–3 são consolidar e ligar, não reconstruir. CSV já existe → onboarding/migração **sobe** (não esperar Fase 11 para o básico). Portal já existe → Fase 12 é jornada, não greenfield. Multiunidade **desce** (P3). Intelligence **depois** do grafo custo.

---

## P0 — bloqueia produto / segurança / verdade

| ID | Item |
|----|------|
| P0-1 | Dump schema live + baseline Git (fonte única) |
| P0-2 | Prova RLS A≠B (tabelas, storage, RPC, export) |
| P0-3 | Canônico `agenda`; aposentar `appointments` |
| P0-4 | Canônico `clients`; aposentar fallback `clientes` |
| P0-5 | Fail-closed catálogo permissões em produção |
| P0-6 | Convite único (remover Edge `dynamic-api` / `convites`) |
| P0-7 | `profiles` RLS; tokens portal legado |
| P0-8 | E2E login-org-agenda-cliente-portal |
| P0-9 | Backup restore não-destrutivo / permissão |

## P1 — o SkinClinic deixa de ser genérico

| ID | Item |
|----|------|
| P1-1 | P&L do procedimento (material real + MO + taxa + explicação) |
| P1-2 | Rateio de fixo configurável |
| P1-3 | Margem em risco **por procedimento** |
| P1-4 | Protocolo aplicado no atalho da agenda (canon) |
| P1-5 | Cockpit sem cards concorrentes; Mês básico |
| P1-6 | Setup progress + CSV com prévia |
| P1-7 | Radar retorno (ritmo, pacote, sem 2º) |
| P1-8 | Papéis recepção/profissional no **backend** |
| P1-9 | Observabilidade 5xx + custo IA |
| P1-10 | LGPD export/exclusão documentada |

## P2

Intelligence, metas ritmo, Market Radar com fonte, Marketing Intelligence estruturado, Minha jornada no portal, lucro/hora, WhatsApp ligado à fila CRM, import IA.

## P3

Evolução da Clínica (XP), pagamento app, contabilidade interna, multiunidade `unit_id`, NFS-e, app stores.

---

## Fases (ordem recomendada)

| Fase | Nome | vs briefing | Motivo |
|------|------|-------------|--------|
| 0 | Fonte única de verdade | igual | Sem isso tudo mente |
| 1 | Segurança + tenant | igual | P0 |
| 2 | Consolidar core (agenda/clientes) | “core operacional” já existe | Unificar duplicatas |
| 3 | Estoque + custos + margem | **subir** (era 4–5) | Diferencial econômico |
| 4 | Precificação explicável | | |
| 5 | Jornada na ficha | | Contexto |
| 6 | Financeiro inteligente | | Cruzar, não novo módulo |
| 7 | CRM + WhatsApp opt-in | | |
| 8 | Onboarding + CSV (já há código) | **subir** vs Fase 11 | Time-to-value |
| 9 | Intelligence + metas | | |
| 10 | Marketing Intelligence + Radar | | |
| 11 | Portal jornada | era 12 | Evoluir existente |
| 12 | Evolução da Clínica | era 10 | P3 |
| 13 | Multiunidade | igual | P3 |
| 14 | Escala | igual | APM, perf |

## Critérios

**Piloto:** P0 verde + agenda/clientes/financeiro/estoque/portal/IA pele sem regressão.  
**Beta:** P1-1..7 visíveis numa clínica piloto.  
**Lançamento:** piloto real, custos IA, UX, LGPD, suporte, incidente — não só `npm test`.
