# Auditoria integral SkinClinic — 2026

**Repo:** `viniciushfc-star/sucesso-skinclinic`  
**Data:** 2026-09-20  
**Regra:** nenhum código, migration ou refactor nesta etapa.  
**Método:** cruzamento frontend (`js/`), backend (`server.js`, `routes/`), SQL (`supabase/`), 3 migrations, docs, flags, testes.

**Tamanho real (ordem de grandeza):** ~52 views, ~80+ services, 21 rotas Express + Google Calendar, ~88 SQL avulsos + 3 migrations, ~70 docs `.md`, 6 regras canônicas `.cursor/rules`, PWA, portal (`portal.html`), agenda pública (`agendar.html`).

---

## 1. O que o SkinClinic é hoje

Um **produto operacional brasileiro para clínica de estética**, já usado como SPA + API + Postgres. Não é um CRUD vazio.

**Já opera (com ressalvas de schema live):** login, org, convite, agenda semanal, clientes + perfil, anamnese, análise de pele (portal + validação), planos terapêuticos, procedimentos, protocolo (método + aplicado), estoque (entrada/consumo), financeiro (caixa, DRE, contas, taxas), CRM inativos/waitlist, marketing IA + calendário, copiloto, OCR, skincare, portal, WhatsApp wa.me/API, Google Calendar, importação CSV, backup/export, auditoria, cockpit Hoje/Atenção/Oportunidades, alerta de aumento de custo.

**Ainda não é:** o sistema operacional inteligente. Os módulos **existem**; o ciclo  
cliente → aplicado → estoque → custo → margem → financeiro → CRM → meta → insight → ação  
**quebra em vários elos**.

---

## 2. Visão original (evidência nos canônicos)

Fontes: `.cursor/rules/*-canon.mdc`, `docs/PLANO-CANONICO.md`, `docs/PROTOCOLO-IDEIA-AMADURECIDA.md`, `docs/FINANCEIRO-CANONICO.md`, `docs/OCR-CANON-PROJETO-SUCESSO.md`, `docs/EQUIPE-CANONICO.md`.

- Protocolo conecta clínico + histórico + viabilidade; humanos decidem.  
- Plano = resposta à dor, não combo de venda.  
- Financeiro cruza, não duplica input, não muda preço.  
- Estoque apoia decisão; não polícia o atendimento.  
- Pele: IA prepara, profissional valida, cliente só vê validado.  
- Copilot explica dados **internos**; não manda.

Ideias (`*-IDEA.md`, `APP-VISAO-GERAL` jan/2025, franquias, pagamento, Prisma/React) são **histórico**, não contrato.

---

## 3. O que ainda existe (implementado com evidência)

| Peça | Evidência |
|------|-----------|
| Agenda operacional | `agenda.views.js`, tabela `agenda`, `supabase-tabelas-base.sql` |
| Cockpit | `cockpit.service.js`, `dashboard.views.js` |
| Margem em risco (embrião) | `estoque-entradas.service.js` action `estoque.custo_aumentou`; `getMargemEmRisco`; card em `financeiro.views.js` / `procedimento.views.js` |
| Custos fixos (lançamentos) | `setup-inicial.views.js` → financeiro; `CUSTOS_FIXOS_COMUNS` |
| Importação CSV | `importacao-lote.service.js` (clientes, procedimentos, financeiro, agenda, custo fixo), rota `#export` |
| Pacotes | `pacotes.service.js`, `client_packages` |
| Protocolo aplicado + trigger consumo | `protocolos_aplicados`, `estoque_consumo_ao_aplicar_protocolo()` |
| Portal + hash token | `routes/create-portal-session.js`, migration `20260920120000` |
| Flags standby | `PAGAMENTO_APP_ENABLED`, `CONTABILIDADE_INTERNA_ENABLED` |

---

## 4. Perdido / esquecido (visão vs produto) — com evidência

Não inventar. Só o que o repo prova.

| Tema | Existia como | Estado |
|------|----------------|--------|
| Intelligence transversal | tese + docs 1.0; copiloto é chat | **não há camada única** |
| Market Radar | briefing 2026; zero tabela/código | **ideia** |
| Gamificação / XP | briefing; sem tabela | **ideia** |
| Metas com ritmo | `financeiro_metas` só master | **parcial financeiro** |
| Migração assistida por IA | CSV sem LLM/mapa/rollback | **parcial commodity** |
| Setup progress % | onboarding = nome da org | **esquecido** |
| Lucro/hora | canon financeiro “futuro”; métricas não calculam | **documentado** |
| Margem em risco completa | alerta de **produto**, não de procedimento/mensal | **parcial** |
| Multiunidade (filial) | docs de mercado falam franquia; código é **multi-org**, não `unit_id` | **docs ≠ produto** |
| `convites` / Edge `dynamic-api` | `user.service.js` `inviteUser` | **legado** vs `organization_invites` + `/api/send-invite-email` |
| Tabela `clientes` | fallback em `metrics.service.js`, `anamnese.views.js` | **legado dual** |
| Tabela `appointments` | `appointments.service.js` create/confirm | **duplicado** vs `agenda` |
| `logs` vs `audit_logs` | `logs.service.js` deprecated | **duplicado** |
| `assinaturas` | `limits.service.js` | **código órfão**; billing não é produto |
| Estudo de caso / OCR | rotas SPA existem; saíram do menu raiz | **escondidos** (não perdidos) |
| Identidade franquia | `IDENTIDADE-VISUAL-FRANQUIAS.md` | logo org existe; tema de rede **ideia** |
| Anamnese Prisma/React | `ANAMNESE-PRISMA-REACT.md` | **ideia abandonada** (anamnese modular no SPA) |

---

## 5–7. Incompleto, quebrado, duplicado

**Incompleto:** permissões granulares no backend vs FE; fail-open catálogo; portal não é jornada; precificação sem rateio; CRM 90d fixo; WhatsApp sem CRM event bus.

**Quebrado / risco funcional:** `docs/ROUTES.md` ainda cita SW `skinclinic-v2` (código foi para network-first v4). `inviteUser` chama Edge que pode não existir. `profiles` policy `USING (true)` em `supabase-tabelas-base.sql`. Restore backup = insert em massa.

**Duplicado:** `agenda`/`appointments`; `clients`/`clientes`; `organization_invites`/`convites`; `logs`/`audit_logs`; `fiscal_*` em dois SQL; waitlist em `rodar-agora` e `crm-waitlist`; copiloto vs N rotas `/api/*` de IA; cards header vs cockpit.

---

## 8. Documentado e não implementado

Market Radar; Intelligence; gamificação; multiunidade; NFS-e (`APIS-PARA-IMPLEMENTAR.md` status `[ ]`); pagamento app; contabilidade interna; Market Intelligence com objetivo/custo/métrica; fail-closed permissões em produção.

## 9. Implementado e mal documentado

Cockpit 2026; importação CSV 2000 linhas; `getMargemEmRisco`; `procedure_stock_usage`; Google Calendar blocks; `ai_usage_events`; token portal hash; `staff`→`funcionario`; waitlist; fidelidade visitas; brinde aniversário; CRM localStorage overlay em `organization-profile.service.js`. `APP-VISAO-GERAL.md` (jan/2025) descreve calendário mensal — a grade semana é o real.

---

## 10. O que torna o produto genérico hoje

Menu de módulos. Dashboard com cards de contagem. Copiloto como tela. Marketing como calendário. Estoque como saldo. Financeiro como lançamentos. Sem o ciclo fechado na UI.

## 11. O que pode torná-lo único

Grafo plano ≠ protocolo ≠ aplicado; consumo → custo → margem em risco **por procedimento**; cockpit de ação; portal validado; importação que reduz time-to-value; Intelligence que **prioriza** (não spam).

---

## 12. Vinte maiores gaps

1. Schema não reproduzível (migrations ≠ 88 SQL).  
2. Prova RLS live A≠B ausente.  
3. Dual `agenda`/`appointments`.  
4. Dual `clients`/`clientes`.  
5. Catálogo de permissão fail-open.  
6. `profiles` RLS permissivo.  
7. Convite legado Edge.  
8. Custo real do procedimento não fecha.  
9. Rateio de fixo não metodológico.  
10. Margem em risco não lista procedimentos afetados.  
11. CRM sem ritmo individual.  
12. Onboarding sem setup progress.  
13. Importação sem preview/rollback/IA.  
14. Intelligence ausente.  
15. Metas sem ritmo/previsão.  
16. Portal não é jornada.  
17. Observabilidade (5xx/latency) ausente.  
18. E2E/RLS testes ausentes.  
19. WhatsApp desconectado do CRM.  
20. Documentação canônica vs `APP-VISAO-GERAL` divergente.

## 13. Vinte diferenciais (existentes ou recuperáveis)

1. Distinção plano/protocolo/aplicado.  
2. Trigger de consumo ao aplicar.  
3. Pele: preliminar interna.  
4. Skincare: rascunho → liberação.  
5. Taxas reais da maquininha.  
6. Simulador de parcela.  
7. Margem em risco (embrião).  
8. Custo fixo checklist.  
9. Pacotes de sessão.  
10. Anamnese modular + portal.  
11. Fotos evolução.  
12. Cockpit operacional.  
13. Waitlist.  
14. Inativos derivados da agenda.  
15. Estudo de caso limitado.  
16. OCR de nota → estoque.  
17. Import CSV.  
18. Auditoria `audit_logs`.  
19. Multi-org.  
20. Copilot “explica, não decide” (canon).

---

## 14–15. Dependências e riscos

Dependência raiz: **dump do banco live**. Sem isso, P1 de margem mente.  
Riscos: IDOR se RLS não aplicada; token portal legado plaintext; service role só no server (OK); prompt injection; restore perigoso; QA 1400 ≠ tenant.

## 16–22. Arquitetura, roadmap, testes, gates

Ver `BLUEPRINT`, `ROADMAP-IMPLEMENTACAO-2026`, `PLANO-TESTES-2026`.  
**Piloto:** schema + RLS prova + E2E + fail-closed + agenda/clientes/financeiro/estoque/portal.  
**Beta:** ciclo custo-margem visível + radar retorno + onboarding setup.  
**Lançamento:** piloto real, custos IA, LGPD, suporte — igual gates 1.0.

**Não READY FOR PILOT. Não READY FOR PUBLIC LAUNCH.**
