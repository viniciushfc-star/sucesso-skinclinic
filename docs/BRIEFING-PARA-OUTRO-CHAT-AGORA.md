# SkinClinic — briefing para outro chat (colar inteiro)

**Data:** 2026-09-27  
**Repo:** `viniciushfc-star/sucesso-skinclinic`  
**Produção:** `https://skinclinic-one.vercel.app`  
**Local:** `http://localhost:3000`  
**Supabase live:** `ipaayevpoqllucltvuhj.supabase.co`

Isto é um **retrato do que já existe**. Não recomeçar o produto. Não tratar como CRUD vazio nem como “agenda + chat de IA”. Não inventar que o OS inteligente já está fechado.

---

## 1. Tese (não negociar)

Sistema operacional de **clínica de estética** (Brasil).

Cadeia que precisa conversar:

```
CLIENTE → AVALIAÇÃO → ANAMNESE → PLANO → PROCEDIMENTO
→ PROTOCOLO → PROTOCOLO APLICADO → ESTOQUE → CUSTO
→ MARGEM → EVOLUÇÃO → RETORNO → RELACIONAMENTO → RECOMPRA
```

- **Plano** = o que foi combinado/vendido  
- **Protocolo** = como executar  
- **Protocolo aplicado** = o que aconteceu na sessão  
- **IA observa e sugere; humano decide.** Nunca auto-alterar preço. Nunca expor `ia_preliminar` no portal. Sem disparo em massa de WhatsApp.

**P3 não começar** enquanto P0/P1 aberto: XP, pagamento in-app, multiunidade, NFS-e, lojas, bot WhatsApp.

Flags: `PAGAMENTO_APP_ENABLED = false`, `CONTABILIDADE_INTERNA_ENABLED = false`.

Papéis: `master` / `gestor` / `recepcao` / `profissional` / `funcionario`. Fail-closed.

---

## 2. Stack

SPA **HTML + ES modules** + Express (`server.js`) → Vercel (`api/index.js`).  
Auth/CRUD: Supabase JWT (anon) + RLS.  
APIs Node: IA, WhatsApp, webhook, portal, Google Calendar, cron, audit.  
**Service role nunca no frontend.**

---

## 3. O que o app JÁ TEM (código)

**Operação:** login (email, Google, criar conta), multi-org, onboarding mínimo, agenda (`agenda`) com espera (`arrived_at`/`started_at`), waitlist, confirmação, lembrete (manual + cron se env), Google Calendar, clientes (`clients`), anamnese (SPA + portal), análise de pele (preliminar interno + validação), planos terapêuticos, procedimentos + custo/margem/comissão, protocolo + aplicado + baixa de estoque, skincare (IA rascunha, profissional libera), fotos evolução, estudo de caso (código; fora do menu raiz), OCR de nota (rota `#ocr`; fora do menu raiz).

**Dinheiro/estoque:** financeiro (entradas/saídas), fechamento do dia, comissões (apuração, não pagamento), pasta/CSV do contador, custo fixo, orçamentos (`rascunho|enviado|aceito|recusado`), pacotes (`client_packages`), lotes/validade, radar de mercado (código).

**CRM/portal:** CRM, lista de espera, modelos de mensagem, portal do cliente (jornada sem preliminar de IA), convites de equipe.

**IA (limites):** Copiloto/Consultora, preço (sugestão, não grava preço), marketing, protocolo, pele, OCR. Sem diagnóstico. Sem mudar preço sozinha.

**Cockpit “Hoje”:** KPIs, atenção/oportunidades, agenda do dia, sala de espera, “o que mudou vs ontem”. Intelligence prioriza; não executa.

---

## 4. Ciclo ouro (elos no código)

`paciente → avaliacao → anamnese → plano → protocolo → aplicado → estoque → custo → margem → crm → inteligencia`

Tabelas: `clients`, `analise_pele`, `anamnesis_registros`, `planos_terapeuticos`, `protocolos`, `protocolos_aplicados`, `estoque_entradas`, `procedures`, `financeiro`, `agenda`.

**Live (org com pacientes `e0951cef-…`):** tem dado em clients (4), estoque (7), procedures (7), financeiro (11), agenda (1). **Vazio:** pele, anamnese, plano, protocolo, orçamento, pacote, eventos. Schema ok; jornada clínica incompleta na amostra.

---

## 5. Banco live vs Git (última prova)

- ~70 tabelas do Git **existem** no live. Colunas usadas pelo código: **30/30 OK**.  
- Canônico: `agenda`, `clients`, `organization_invites`.  
- Legado (não apagar): `appointments` (vazio), `clientes` (outras pessoas, id bigint ≠ UUID), `convites`.  
- QA master está na org **com** os 4 pacientes.  
- 2 agendas órfãs (`org_id` nulo) já foram apagadas.  
- **RLS agenda:** SQL `supabase/supabase-agenda-rls-colar.sql` aplicado. JWT e service leem a mesma linha (n=1). Confirmações n=4.  
- INSERT `clients` outra org: **42501**. Sem leak de lista nas tabelas testadas.  
- RPC `get_analises_pele_by_token`: erro **42601** (assinatura live).  
- APIs Vercel com `org_id` de outra org: **HTTP 500** (esperava 403). Git local já 403 por membership no JWT (`lib/api-auth.js`). **Falta deploy** + conferir `SUPABASE_SERVICE_KEY` na Vercel (anônimo 401; JWT 500 em `/api/integracoes-status`).

SQL que o humano cola no Editor (não via PostgREST): arquivos `*-colar.sql` e `supabase/migrations/`.

---

## 6. UI (onde paramos)

Identidade: **azul `#4e54c8` / violeta `#4f46e5`**, Inter + Plus Jakarta Sans.  
Marca: símbolo de **3 círculos deslocados** (camadas), wordmark SkinClinic, tagline **Beleza com propósito**. Favicon/PWA em `assets/`.

- Login polido (card, labels, Google/criar conta secundários).  
- App interno: **casco claro** (menu/topo claros, indigo no item ativo e botões). Tema escuro permanece.  
- Mobile: `viewport` no dashboard; menu gaveta.  
- **Não** usar o redesign teal/bege (`preview/redesign-1.html` está **descartado**).  
- Referência visual aceita: dashboard SaaS **claro** de clínica (tipo a imagem ChatGPT “Dashboard SaaS para Clínica de Beleza”) — polish, não produto novo.  
- Prévia estática: `http://localhost:3000/preview/polish-clinica.html`

---

## 7. O que NÃO fazer

- Não auto-preço, não WhatsApp em massa, não expor `ia_preliminar`.  
- Não P3. Não “redesign 1.0” teal.  
- Não apagar `clientes` legado.  
- Não colocar service role no front.  
- Não fingir que ciclo ouro está populado no live (muitos elos n=0).  
- Integridade > feature nova.

---

## 8. Próximos buracos (ordem)

1. **Deploy** do Git (auth JWT + UI) para a Vercel deixar de devolver 500 em staff APIs.  
2. APIs cross-org **403** no live (reteste `scripts/rls-tenant-ab.js`).  
3. Corrigir RPC `get_analises_pele_by_token` (42601).  
4. Só então amostra de ciclo (orçamento, anamnese, plano) se quiser demo clínica.  
5. UI: continuar o polish **claro** nas views internas **sem** mudar fluxos.

Testes: `npm test` (concurrency 1). Lotes live 32, 38–40, 41 marca/login.

---

## 9. Arquivos-chave

- Auth API: `lib/api-auth.js`  
- SPA: `js/core/spa.js`, `dashboard.html`, `index.html`  
- CSS: `js/css/style.css` (`:root` tokens `--sc-blue` / `--sc-violet`)  
- Marca: `js/core/brand.js`, `assets/brand-mark.svg`, `assets/favicon.svg`  
- Ciclo: `js/utils/golden-flow.js`, `js/utils/golden-flow-auth.js`  
- Live: `scripts/ciclo-ouro-org-dados.js`, `scripts/confronto-git-live.js`, `scripts/rls-tenant-ab.js`  
- Relatos: `docs/CICLO-OURO-ORG-DADOS.md`, `docs/CONFRONTO-GIT-LIVE.md`, `docs/FASE-2-RLS-ORG-AB.md`  
- Tese longa: `docs/BRIEFING-PARA-OUTRO-CHAT-2026.md`, mapas `docs/MAPA-*-2026.md`
