# Auditoria SkinClinic 1.0

**Repositório:** `viniciushfc-star/sucesso-skinclinic`  
**Data:** 2026-09-20  
**Escopo:** código, `supabase/*.sql`, 3 arquivos em `supabase/migrations/`, `.cursor/rules`, `docs/` canônicos, produção observada (`skinclinic-one.vercel.app`).  
**Método:** evidência de arquivo. Não assume que o nome da pasta prova a feature. Não assume que o SQL avulso foi aplicado no projeto live.

**Fonte canônica de produto (quando há conflito):** `.cursor/rules/*-canon.mdc` + `docs/PLANO-CANONICO.md` + `docs/PROTOCOLO-IDEIA-AMADURECIDA.md` + `docs/FINANCEIRO-CANONICO.md`. Docs de ideia (`*-IDEA.md`, jan/2025) são histórico, não contrato.

**Veredito de lançamento:** **não READY FOR PILOT**. Operação fechada/piloto técnico possível com riscos conhecidos. **não READY FOR PUBLIC LAUNCH**.

---

## Legenda

| Rótulo | Significado |
|--------|-------------|
| IMPLEMENTADO | Código + persistência + UI (ou API) ligados; ambiente live não re-provado nesta auditoria |
| PARCIAL | Existe caminho, falta cruzamento, UX, RLS ou garantia de schema |
| DOCUMENTADO MAS NÃO IMPLEMENTADO | Doc/regra descreve; código não entrega |
| QUEBRADO | Código aponta para objeto errado ou fluxo comprovadamente falho |
| INSEGURO | Superfície de isolamento/authz insuficiente |
| DUPLICADO | Duas fontes de verdade |
| LEGADO | Código ou doc que não deve guiar o produto |
| AUSENTE | Não existe no repo de forma utilizável |

---

## A. Arquitetura — PARCIAL

SPA HTML + ES modules (`dashboard.html`, `js/core/spa.js`) + Express (`server.js`) empacotado em Vercel (`api/index.js`). CRUD clínico no browser via Supabase anon + RLS. Express para IA, WhatsApp, webhook, portal session, Google Calendar, cron.

**Decisão anterior correta:** service role só no servidor.  
**Decisão anterior ruim:** schema espalhado em ~88 SQL manuais; app assume que o Dashboard Supabase já tem as tabelas.

Não é Next/React. Bundle não é bundler: muitos módulos ESM + cache PWA.

---

## B. Banco — INSEGURO / DUPLICADO / PARCIAL

| Evidência | Fato |
|-----------|------|
| `supabase/migrations/` | Só 3 patches (P0 RLS convite/financeiro, P1 portal/IA/calendar, P0 token hash + storage privado + whatsapp_logs) |
| `supabase/supabase-*.sql` | ~88 one-offs; ordem em `supabase-ordem-scripts.md` / `docs/FALTA-NO-BANCO.md` |
| App usa | `clients`, `agenda`, `financeiro`, `protocolos_aplicados`, … |
| App também escreve | `appointments` em `appointments.service.js` (`createAppointment` / `confirmAppointment`) — **DUPLICADO** com `agenda` (grade real) |

`docs/FALTA-NO-BANCO.md` está **LEGADO/desatualizado** em trechos (diz que `organization_invites` e `whatsapp_logs` não têm CREATE; há scripts). Continua verdadeiro: **não há dump reproduzível do schema day-1**.

Nenhum `CREATE TABLE organizations` consolidado nas migrations oficiais.

---

## C. RLS — PARCIAL / INSEGURO

Policies existem em dezenas de scripts. Isolamento **depende do que foi rodado no projeto**. Migrations oficiais não cobrem o catálogo.

Padrão org: `org_id IN (SELECT org_id FROM organization_users WHERE user_id = auth.uid())`.

**P0 restante:** prova live tabela a tabela (ORG A ≠ ORG B) incluindo Storage, RPC SECURITY DEFINER, export/backup.

Convite: P0 membership insert restringe self-join (migration `20260914120000`). Ainda exige que essa migration esteja aplicada.

---

## D. Segurança — PARCIAL

**IMPLEMENTADO:** JWT Bearer nas APIs staff; org é contexto; webhook recusa sem secret; estáticos `/routes` `/lib` 404 na Vercel; CORS allowlist; portal sem `ia_preliminar` (teste p0-02 + rotas); token portal hash + TTL 7d (código + migration 20260920); `staff`→`funcionario` no FE; logout limpa `active_org_id`; `ALLOW_PORTAL_SESSION_DEV` ignorado em Vercel production/preview.

**INSEGURO / conflito com briefing atual:** se `organization_user_permissions` **não existe**, API **cai na role** (`isMissingPermissionCatalog`). Briefing pede FAIL CLOSED em produção. Hoje é fail-open para o mapa de role (não para erro genérico de DB).

**PARCIAL:** prompt injection (texto do cliente concatenado); custo IA com Map + hydrate; tokens portal antigos em claro até expirar.

**Red team:** catálogo QA live (~1400 casos) prova HTTP/403/páginas, **não** RLS row-level nem Storage path.

---

## E. APIs — IMPLEMENTADO (conjunto) / PARCIAL (governança)

Registradas em `server.js`: copiloto, preco, marketing, ocr, estoque, estudo-caso, discussao, protocolo, pele, skincare, analise-pele*, calendario, webhook, portal-session, invite email, lembretes, whatsapp, google-calendar*. Health GET.

Maioria: `requireStaffAccess` + permission. Portal: token RPC. Cron: `CRON_SECRET` ou JWT staff.

---

## F. Frontend — IMPLEMENTADO / LEGADO visual

~30 rotas SPA. Menu raiz (set/2026): Hoje, Cadastrar, Agenda, CRM, Procedimentos, Financeiro, Marketing, Estoque, Anamnese (flag), Skincare, Protocolo, Exportar, Configurações.

Ainda no router mas **fora do menu raiz:** estudo-caso, ocr, para-clinicas, pagamento.

Visual produção: Inter + gradiente indigo (`style.css`). Prévia `preview/ux-clinica.html` **não publicada**.

PWA: `sw.js` network-first após Fase 0.

---

## G. UX — PARCIAL

Cockpit “O que olhar agora” (Hoje / Atenção / Oportunidades) **IMPLEMENTADO** no dashboard publicado (set/2026). Header global ainda mostra cards Clientes/Agenda/Faturamento (**DUPLICADO** de hierarquia).

Onboarding: só nome da clínica. Empty states pontuais. `alert()` no onboarding. Sem drawer mobile. Sem design system único.

---

## H. IA — PARCIAL (desenho canônico IMPLEMENTADO; “intelligence” AUSENTE)

Canônico: `.cursor/rules/copilot-canon.mdc`, `analise-pele-ia-canon.mdc`.

Existe: copiloto, preço, marketing, ocr, estoque IA, protocolo texto, pele, skincare rascunho, estudo de caso, análise de pele preliminar+validação, `ai_usage_events`, budget ~US$2/user/mês.

**AUSENTE:** SkinClinic Intelligence (event bus operacional, insights consolidados sem spam). Copiloto ainda pode ser tela/rota, não só contexto na ficha.

IA **não** altera preço sozinha (regra travada em protocolo). Rotas devolvem rascunho.

---

## I. Financeiro — PARCIAL

Canônico: `docs/FINANCEIRO-CANONICO.md` — cruzar, não duplicar input; não alterar preço.

IMPLEMENTADO: entradas/saídas, DRE simplificado, contas a pagar → saída, taxas maquininha, valor_recebido, procedure_id, importação, pasta contador (flag contabilidade interna OFF).

PARCIAL: margem real cruzando consumo de estoque + rateio de fixo.  
AUSENTE: radar financeiro completo do briefing.  
DOCUMENTADO: `CONTABILIDADE_INTERNA_ENABLED = false`.

---

## J. Estoque — PARCIAL (canônico alinhado)

Canônico: estoque **não trava** atendimento. Trigger de consumo ao aplicar protocolo **IMPLEMENTADO** nos SQL canon (estimado vs real em scripts separados).

PARCIAL: impacto “insumo subiu → quais procedimentos” não é produto. OCR é assistente, menu NFS saiu da raiz.

---

## K. Precificação — PARCIAL

IMPLEMENTADO: valor cobrado, custo material estimado, margem mínima, comissão %, simulador de taxa/parcelas, IA `/api/preco` rascunho.

AUSENTE: custo total = material real + MO + fixo rateado + taxa + inadimplência configurável com **explicação componente a componente** persistida. Market Radar **AUSENTE**.

Regra canônica: simulação de desconto, nunca “dê X%”.

---

## L. Agenda — IMPLEMENTADO / DUPLICADO

Grade semana Mon–Sat no app. Célula vazia cria horário. Cores por profissional na prévia, produção semana fixa.

DUPLICADO: tabela `agenda` (operação) vs `appointments` (trechos de service). Confirm/release no modelo `appointments` pode não ser o mesmo objeto da grade.

Google Calendar: blocos de indisponibilidade (PARCIAL, env OAuth).

---

## M. CRM — PARCIAL

IMPLEMENTADO: inativos derivados da agenda, waitlist, fidelidade por visitas, brinde aniversário (org), cockpit lista inativas 90d + espera.

AUSENTE: segmentos VIP/PACOTE ATIVO como modelo, radar de retorno com ritmo individual (ex. “voltava a cada 30 dias”), ações com consentimento.

---

## N. Portal — PARCIAL / IMPLEMENTADO no desenho de pele

Token, cadastro, termo, análise (só validado), skincare se liberado, agendar público (`agendar.html`).

AUSENTE: “Minha jornada” unificada (avaliação→sessões→evolução). TTL 7d + hash nas sessões **novas**.

---

## O. WhatsApp — PARCIAL

wa.me default; API se env; cron lembretes; templates; logs com RLS se tabela existir.

Não é caixa de mensagens completa. Automação sem opt-out de produto maduro = risco LGPD se ligar massa.

---

## P. Metas — PARCIAL

Tabela/UI `financeiro_metas` (SQL master, só master). Não é o sistema de metas/ritmo/previsão do briefing (P2/P3 até P1 de custo/margem existir).

---

## Q. Gamificação — AUSENTE / DOCUMENTADO MAS NÃO IMPLEMENTADO

Não há XP, badges, missões no código. Não priorizar (P3) enquanto P0 schema/RLS e P1 margem existirem.

---

## R. Marketing — PARCIAL / LEGADO de menu

IA sugestões + calendário de conteúdo. Não é Marketing Intelligence com objetivo/custo/métrica. Menu ainda na raiz (recepção).

---

## S. Analytics — PARCIAL

Métricas dashboard + rankings. Sem north star instrumentado. Sem produto analytics (activation, retenção de clínica).

---

## T. Onboarding — PARCIAL

Criar org por nome. Tutorial opcional. Sem caminho até primeiro protocolo aplicado (momento aha).

---

## U. Performance — AUSENTE de medição / PARCIAL no código

`select("*")` frequente (clientes, agenda). Chart.js no dashboard. Sem LCP/TTI no repo.

---

## V. Observabilidade — PARCIAL

`console.log("[OPENAI_COST]")` + `ai_usage_events`. Sem 4xx/5xx/latency agregados. Sem APM.

---

## W. LGPD — PARCIAL (técnico) — sem afirmação jurídica

Termos, consentimento portal, minimização na análise de pele. Backup agora usa `clients`/`agenda`/`financeiro`. Fotos clínicas privadas (migration 20260920). Export/exclusão de titular **PARCIAL**. Não declarar conformidade.

---

## X. Vercel — IMPLEMENTADO

Catch-all API, cron lembretes, functions 60s. Deploy via push `main`. Proteção de deploy (403 em health) já ocorreu em QA.

---

## Y. Testes — PARCIAL

`npm test`: p0-01 auth, p0-02 pele, p0-03 fase0, imports, catálogo QA. GitHub Actions `test.yml`.  
**AUSENTE:** E2E Playwright, RLS ORG A/B, storage IDOR, pricing, goals.

QA live ≠ prova de tenant.

---

## Z. Prontidão — NÃO READY FOR PILOT (gates do briefing)

| Gate | Estado |
|------|--------|
| Segurança crítica | PARCIAL (schema drift) |
| RLS aprovado | não (falta evidência live) |
| Banco reproduzível | não |
| Onboarding | mínimo |
| Agenda / clientes / financeiro | usáveis |
| Estoque / precificação | parciais vs tese |
| Portal / IA / permissões | usáveis com ressalvas |
| Backup | corrigido no código; restore perigoso (insert em massa) |
| E2E | não |

**Classificação honesta:** produto **operável** para clínica piloto consciente do risco de schema; **não** SaaS de lançamento público.

---

## Conflitos (não escolher em silêncio)

1. **Fail-open de catálogo de permissão** vs briefing FAIL CLOSED. Canônico de segurança desta auditoria: em `VERCEL_ENV=production`, ausência da tabela deve 500/403, não role.  
2. **`agenda` vs `appointments`.** Canônico operacional: `agenda`. `appointments` é legado a consolidar.  
3. **Protocolo no menu** vs canônico “vive na ficha + atalho agenda”. Menu Protocolo hoje gera texto IA — confunde com aplicado.  
4. **Papéis** `master/gestor/staff|funcionario` vs briefing MASTER/GESTOR/PROFISSIONAL/RECEPÇÃO/VIEWER. Viewer existe em trechos de UI antiga, não no mapa completo.  
5. **`docs/FALTA-NO-BANCO.md` vs SQL atual.**  
6. **`docs/APP-VISAO-GERAL.md` (jan/2025)** vs menu 2026.  
7. **Copilot canônico** (“não use dados externos”) vs briefing Market Radar (dados externos com fonte). Resolver: radar é módulo separado, nunca misturar no Copilot clínico.  
8. **Estoque canônico** (não polícia) vs briefing “estoque mínimo / alertas” — compatível se alerta ≠ bloqueio.

## Funcionalidades esquecidas a recuperar (tese)

- Taxas reais da maquininha + simulador (já no produto; subcomunicado).  
- Plano terapêutico como resposta à dor (`PLANO-CANONICO`) — UI existe, jornada não.  
- Protocolo aplicado + consumo (existe; não é o centro da ficha).  
- Estudo de caso 2–3 métricas (existe; saiu do menu raiz — correto).  
- Pacotes de sessões (`client_packages`) — verificar se a aba do perfil está visível.  
- Waitlist + inativos — embrião do radar.

## Dependências para qualquer P1 de margem

`protocolos_aplicados` → `estoque_consumo` → custo unitário do lote → procedimento → financeiro `procedure_id` → taxas org. Sem schema único, o cruzamento mente.
