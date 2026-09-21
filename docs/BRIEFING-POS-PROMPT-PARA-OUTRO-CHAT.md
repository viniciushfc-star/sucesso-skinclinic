# SkinClinic — o que fizemos DEPOIS do prompt (handover para outro chat)

**Como usar:** copie este arquivo inteiro e cole no outro chat.  
**Data deste relato:** 2026-09-21  
**Repo:** `viniciushfc-star/sucesso-skinclinic`  
**Produção:** `https://skinclinic-one.vercel.app`

Isto **não** substitui a tese do produto. Serve para o outro chat **não recomeçar do zero** nem inventar que o app já é o “sistema operacional inteligente”.

Briefing anterior (visão / o que existe / o que falta): `docs/BRIEFING-PARA-OUTRO-CHAT-2026.md`.

---

## 1. O que o prompt original pedia

Auditoria **antes** de implementar. Depois: verdade do banco → segurança/tenant → operação → custo/margem → inteligência.  
P0 aberto **bloqueia** P2/P3 (Intelligence, Market Radar, gamificação, pagamento no app).  
Não tratar o SkinClinic como CRUD vazio nem como “agenda + IA”.

O chat anterior **seguiu isso**: primeiro só documentação; só depois o usuário disse para **rodar**.

---

## 2. O que FOI feito (ordem real)

### A) Só documentação (Fase 0) — sem código de produto

Inventário e mapas (evidência de arquivo, live = NÃO COMPROVADO naquela hora):

- `docs/AUDITORIA-INTEGRAL-SKINCLINIC-2026.md`
- `docs/MAPA-FUNCIONALIDADES-SKINCLINIC-2026.md`
- `docs/MAPA-BANCO-SKINCLINIC-2026.md`
- `docs/MAPA-APIS-SKINCLINIC-2026.md`
- `docs/MAPA-PERMISSOES-SKINCLINIC-2026.md`
- `docs/MAPA-INTEGRACOES-SKINCLINIC-2026.md`
- `docs/MAPA-FLUXOS-SKINCLINIC-2026.md`
- `docs/MAPA-TENANT-MATRIZ-2026.md`
- `docs/FASE-0-INVENTARIO-CICLO.md`
- `docs/ROADMAP-IMPLEMENTACAO-2026.md`
- `docs/PLANO-TESTES-2026.md`
- `docs/BRIEFING-PARA-OUTRO-CHAT-2026.md`

**Não** se implementou Intelligence, Market Radar, XP, motor de preço completo, merge de tabelas, nem “terminar o app”.

### B) Usuário: “pode rodar” → Fase 1 banco

Probe **live** (PostgREST + service role, **não** é `pg_dump`):

- Script: `scripts/schema-probe-live.js`
- Relato: `docs/FASE-1-PROBE-LIVE.md`, `docs/FASE-1-BANCO-CICLO.md`

**Fato live:** as **63 tabelas** da lista de probe **existem**. Não era “SQL que nunca rodou”.

Contagens (linhas):

| Tabela | Linhas | Nota |
|--------|--------|------|
| `agenda` | 3 | Canônica da grade |
| `appointments` | 0 | Legado vazio |
| `clients` | 4 | Canônica |
| `clientes` | 3 | **Outras 3 pessoas** (0 IDs em comum com `clients`) |
| `organization_invites` | 13 | Canônica |
| `convites` | 1 | Legado |
| `audit_logs` | 50 | |
| `logs` | 2 | Legado |
| `assinaturas` | 0 | Órfão |
| `organization_user_permissions` | existe | |

**Por isso NÃO se apagou `clientes`.** Unificar agora perderia cadastro. Fallback no front **permanece**.

Código Git desta fase:

- `lib/api-auth.js`: em Vercel production/preview (ou `NODE_ENV=production`), catálogo de permissão **ausente** → **500**, não cai na role.
- `appointments.service.js` + `confirmations.service.js`: **não gravam mais** em `appointments`; usam `agenda`.
- `user.service.js` `inviteUser`: **não** chama mais Edge `dynamic-api`. A UI já convida via `organization_invites`.
- `js/core/spa.js`: erro de `checkPermission` **esconde** o item do menu (antes podia mostrar).
- Migration `supabase/migrations/20260921120000_p0_fase1_permissions_profiles.sql` — RLS de `profiles` sem `USING (true)`.
- **O usuário confirmou que rodou este SQL no Supabase.**

Testes de contrato no repo: **50/50** (`npm test`).

### C) Usuário: “já rodei, próximo passo” → Fase 2 RLS

Script: `scripts/rls-tenant-ab.js` (`npm run test:rls-ab`).  
Relato: `docs/FASE-2-RLS-ORG-AB.md`.

Ator: JWT `QA_EMAIL_MASTER` (chave **anon**, não service role).  
Esse usuário está em **1 org**. O projeto tem **12 orgs** (11 outras).

| Prova | Resultado |
|-------|-----------|
| SELECT lista `clients`/`agenda`/financeiro/estoque/protocolos/pele/sessions | **não vazou** org B (0 linhas da org do QA; os 4 clients estão em **outra** org) |
| IDOR `clients` por `id` da org B | **vazio** (PASS) |
| INSERT `clients` com `org_id` da org B | **42501** (PASS) |
| `profiles` leak de user de outra org | 0 (PASS) |
| `audit_logs` SELECT | **FAIL** — `unrecognized configuration parameter "app.org_id"` |
| `POST /api/copiloto` com `org_id` da org B (Vercel) | **HTTP 500** (FAIL de status; **não** se observou vazamento de dado neste teste) |

Storage e RPCs do portal **não** foram cobertos.

Migration criada, **ainda precisa o usuário rodar no SQL Editor** (não foi o mesmo SQL da Fase 1):

`supabase/migrations/20260921130000_p0_audit_logs_rls.sql`

---

## 3. Como o APP está AGORA (honesto)

### Produção (Vercel)

O site **continua o produto operacional** de sempre: login, org, agenda, clientes, financeiro, estoque, portal, IA, cockpit, etc.

O **código novo** (fail-closed, agenda canônica, convite, menu) **só vale na Vercel depois de um git push/deploy**. Se ninguém publicou depois destas alterações, produção ainda pode estar no commit anterior.

O **banco live** já tem as tabelas; a policy de `profiles` vale **se** o SQL `20260921120000` foi mesmo aplicado (usuário disse que sim).  
`audit_logs` **ainda quebrava** no teste RLS — a tela Auditoria pode falhar até rodar `20260921130000`.

### Produto / tese

**Não mudou o posicionamento.** Continua:

- Módulos existem.
- O grafo cliente → aplicado → estoque → custo real → margem → retorno **não fecha**.
- **Não** READY FOR PILOT (RLS não homologada por completo; API 500; Storage/RPC faltando).
- **Não** READY FOR PUBLIC LAUNCH.

### O que o app “é” na prática

SPA HTML + Express + Supabase. CRUD no browser + RLS. APIs JWT + `org_id` de contexto. Service role só no servidor.

Canônicos operacionais confirmados no live: **`agenda`** e **`clients`**.  
Legado paralelo: `appointments` (vazio), `clientes` (**3 registros reais**), `convites`, `logs`.

---

## 4. O que NÃO foi feito (não inventar)

- Merge `clientes` → `clients`
- DROP de tabelas legado
- `pg_dump` / schema 100% em migrations
- Prova RLS de **Storage** e **RPC portal**
- Corrigir 403 vs 500 do Copiloto na Vercel (precisa deploy)
- Motor de custo/preço, margem por procedimento, Intelligence, Market Radar, gamificação, setup progress, jornada do portal
- Publicar / commit / push (a menos que o usuário tenha feito fora deste chat)

---

## 5. Próximos passos corretos (para o outro chat não pular)

1. Rodar `20260921130000_p0_audit_logs_rls.sql` no Supabase.  
2. `npm run test:rls-ab` de novo.  
3. **Deploy** do Git para a Vercel (fail-closed + agenda + convite).  
4. Só então: plano de merge `clientes`→`clients` com prévia; mais tabelas no IDOR; Storage.  
5. **Não** começar P2/P3.

---

## 6. Regras para quem continuar

- Não tratar frontend como segurança.  
- Não `PAGAMENTO_APP_ENABLED = true`.  
- Não service role no browser.  
- Não expor `ia_preliminar` no portal.  
- Não alterar preço automaticamente.  
- Não apagar `clientes` sem migrar as 3 linhas.  
- Não criar segundo Copiloto / segundo financeiro / segunda agenda.  
- Se não puder provar live, escrever **NÃO COMPROVADO**.

---

## 7. Frase única

> Depois do prompt: auditamos (docs), depois **medimos o banco live** (63 tabelas existem; `clientes` e `clients` são pessoas diferentes), **paramos de escrever em `appointments`**, **fechamos o fail-open de permissão em produção no código**, **testamos RLS com JWT** (lista e IDOR de `clients` não vazararam; insert org B bloqueado). O app **ainda é o SaaS operacional de estética**, não o OS inteligente. Auditoria SQL de `audit_logs` e deploy Vercel / 403 da API ainda estão abertos. Isolamento **não** está homologado por completo.
