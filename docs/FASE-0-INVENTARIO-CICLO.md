# Fase 0 — Inventário e auditoria base (ciclo 1)

**CICLO:** 1 — FASE 0  
**OBJETIVO:** conhecer a verdade do repositório. **Nenhuma alteração de código.**  
**DATA:** 2026-09-20  
**REPO:** `viniciushfc-star/sucesso-skinclinic`  
**PRODUÇÃO OBSERVADA:** `https://skinclinic-one.vercel.app` (comportamento visual histórico; **schema live = NÃO COMPROVADO neste ciclo**)

**ARQUIVOS ANALISADOS (amostra representativa, não “todo byte”):**  
`package.json`, `vercel.json`, `server.js`, `api/index.js`, `lib/api-auth.js`, `js/core/spa.js`, `js/core/permissions.js`, `js/core/permissions.map.js`, `js/core/feature-flags.js`, `routes/*`, `supabase/migrations/*` (3), greps `CREATE TABLE` / RPC / RLS, `scripts/test-p0-01-auth.js`, docs canônicos e auditorias 2026 já no Git.

**TESTES DESTE CICLO:** nenhum novo. Existentes: `npm test` (contrato de helpers, pele, fase0, imports, catálogo). **RLS Org A≠B: NÃO COMPROVADO.**

**ALTERAÇÕES REALIZADAS:** só documentação nova desta fase (mapas API/permissões/integrações/fluxos + este relatório). Sem refactor.

**PRÓXIMO CICLO (quando autorizado):** Fase 1 banco — dump/diff live vs Git. Ainda sem features.

---

## 1. Estado atual real

Produto **operacional grande**, SPA + Express + Supabase. **Não** é CRUD vazio. **Não** é o OS inteligente da tese. Módulos existem; o grafo cliente→aplicado→estoque→custo→margem→CRM **não fecha**. Banco Git **fragmentado**. Isolamento **não testado neste ciclo**.

**READY FOR PILOT:** não. **READY FOR PUBLIC LAUNCH:** não.

## 2. Arquitetura real

```
Browser (dashboard.html SPA, index.html auth, portal.html, agendar.html, onboarding.html)
  ├─ supabase-js + anon key + RLS   → Postgres (CRUD clínico)
  └─ Bearer JWT + org_id contexto  → Express (api/index.js / server.js)
                                      └─ service role (só servidor)
Cron Vercel 11:00 UTC → /api/lembretes-auto
```

`vercel.json`: catch-all `/(.*)` → `/api`; 404 em `/routes`, `/lib`, `/supabase`, `.env`. Function 60s, 1024MB, include `routes,lib,ai,js/core`.

Frontend **não** é autoridade. Há falha UX: sidebar trata erro de `checkPermission` como **mostrar item** (`spa.js`). Isso não substitui RLS, mas é fail-open de menu.

## 3–8. Mapas

| Mapa | Arquivo |
|------|---------|
| Funcionalidades | `docs/MAPA-FUNCIONALIDADES-SKINCLINIC-2026.md` |
| Banco | `docs/MAPA-BANCO-SKINCLINIC-2026.md` |
| APIs | `docs/MAPA-APIS-SKINCLINIC-2026.md` **(novo)** |
| Permissões | `docs/MAPA-PERMISSOES-SKINCLINIC-2026.md` **(novo)** |
| Integrações | `docs/MAPA-INTEGRACOES-SKINCLINIC-2026.md` **(novo)** |
| Fluxos | `docs/MAPA-FLUXOS-SKINCLINIC-2026.md` **(novo)** |
| Tenant (matriz) | secção neste arquivo + `MAPA-TENANT-MATRIZ-2026.md` |

**LIVE (Supabase produção):** para **todas** as tabelas/policies = **NÃO COMPROVADO** (sem dump neste ciclo).

## 9. Duplicidades

| Par | Quem usa | Canônico proposto | Status |
|-----|----------|-------------------|--------|
| `agenda` × `appointments` | grade/`listAppointmentsByDate` vs create/confirm em `appointments.service.js` | `agenda` | DUPLICADO / appointments sem CREATE no grep |
| `clients` × `clientes` | clientes.service vs fallback metrics/anamnese | `clients` | LEGADO |
| `organization_invites` × `convites` + Edge `dynamic-api` | invite.service vs user.service inviteUser | invites + `/api/send-invite-email` | CONFLITANTE |
| `audit_logs` × `logs` | audit.service vs logs.service deprecated | `audit_logs` | LEGADO |
| Copiloto × N `/api/*` IA | telas + rotas | um Intelligence (P2); APIs podem permanecer | PARCIAL |
| Protocolo ficha × `#protocolo` IA | | ficha+agenda | CONFLITANTE UX |
| `financeiro_metas` × motor de metas | | não confundir | PARCIAL |
| Role map × PERMISSIONS extras | funcionario sem `financeiro:manage` etc. | backend | CONFLITANTE |

## 10. Conflitos

- Fail-open catálogo: `isMissingPermissionCatalog` → trata como sem override → **cai na role**. Query error genérico = fail-closed. **P0.**  
- Papéis `viewer`/`admin` no FE (`permissions.js`) **não** estão no `ROLE_PERMISSIONS`.  
- Rota `#procedimento` exige só `dashboard:view` — **funcionario vê procedimentos**.  
- Copilot interno vs Market Radar.  
- Docs jan/2025 vs app 2026.

## 11–13. Perdidas / incompletas / quebradas

**Perdidas (visão sem código):** Intelligence, Market Radar, XP, setup %, lucro/hora, multiunidade, Prisma anamnese.  
**Incompletas:** margem em risco só produto; CSV sem rollback; CRM 90d; portal ≠ jornada; custos fixos = lançamento; onboarding = nome.  
**Quebradas / risco funcional (código):** dual agenda; dual clientes; invite Edge; `profiles` RLS SELECT true no SQL; restore backup. **Live:** NÃO COMPROVADO se quebram em produção.

## 14–15. Riscos segurança / tenant

| Risco | Evidência | Prova Org A≠B |
|-------|-----------|----------------|
| RLS depende do que foi rodado no live | 88 SQL + 3 migrations | **NÃO COMPROVADO** |
| Service role nas APIs após JWT+membership | `getAdminClient` | bypass RLS — org **tem** que estar no membership |
| Portal RPC SECURITY DEFINER | tokens | hash vs plaintext legado |
| Webhook service role após secret | org via `contas_vinculadas` | se account_id vazar = risco |
| Storage | migration 20260920 privada | **NÃO COMPROVADO live** |
| `select("*")` clientes/agenda/financeiro | services | excesso de dados |
| audit_logs insert do browser | `audit.service.js` | adulterável |
| Sidebar fail-open | spa.js | UX |
| OAuth callback | state assinado (teste p0-01) | replay **NÃO COMPROVADO** E2E |
| OCR/IA custo e PII | rotas | |

## 16–19. P0 / P1 / P2 / P3

Ver `docs/ROADMAP-IMPLEMENTACAO-2026.md`. Resumo: P0 verdade+tenant+duplicatas+fail-closed+E2E; P1 grafo custo/protocolo/CRM/setup; P2 Intelligence/radar; P3 XP/pagamento/filial.

## 20. Top 20 problemas

1. Sem dump live  
2. Sem teste RLS A≠B  
3. Dual agenda  
4. Dual clients  
5. Fail-open permissões  
6. Invite legado  
7. profiles RLS  
8. Tokens portal plaintext legado  
9. audit_logs pelo FE  
10. Backup restore  
11. Custo real ausente  
12. Margem risco incompleta  
13. Protocolo UX  
14. Menu procedimento = dashboard:view  
15. Sidebar fail-open  
16. select *  
17. CRM hardcoded 90d  
18. Docs desatualizados  
19. QA 1400 ≠ tenant  
20. N copiloto sem Intelligence  

## 21. Top 20 oportunidades (já no código — ligar, não reinventar)

1. Trigger consumo  
2. procedure_stock_usage  
3. Taxas maquininha  
4. getMargemEmRisco  
5. CSV import  
6. Cockpit  
7. Pele validada  
8. Pacotes  
9. Waitlist  
10. Inativos  
11. Planos terapêuticos  
12. Protocolo aplicado  
13. Fotos evolução  
14. Custo fixo checklist  
15. Webhook idempotente (se coluna)  
16. Google Calendar blocks  
17. Portal hash  
18. Estudo de caso  
19. OCR  
20. ai_usage_events  

## 22. Dependências

Dump live → unificar agenda/clients → fail-closed (decisão) → E2E → só então P&L.

## 23–24. Roadmap e testes

`docs/ROADMAP-IMPLEMENTACAO-2026.md`, `docs/PLANO-TESTES-2026.md`.

---

### Relatório de ciclo (Fase 43)

| Campo | Valor |
|-------|--------|
| CICLO | 1 FASE 0 |
| PROBLEMAS | ver top 20 |
| CAUSA RAIZ | produto cresceu por SQL avulso + módulos; tese do grafo nunca foi a fonte de verdade do Git |
| IMPACTO | risco de isolamento e de “IA+agenda genérica” |
| PRIORIDADE | P0 banco/tenant |
| CORREÇÃO PROPOSTA | não nesta fase |
| ALTERAÇÕES | docs novos apenas |
| TESTES | não executados contra live |
| RESULTADOS | inventário |
| RISCOS RESTANTES | todos os P0 |
| DEPENDÊNCIAS | acesso ao projeto Supabase para dump |
| PRÓXIMO | Fase 1 banco, ainda sem feature |
