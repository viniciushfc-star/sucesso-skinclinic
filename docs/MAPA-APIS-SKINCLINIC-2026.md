# Mapa das APIs SkinClinic — 2026

**Evidência:** `server.js` `registerRoutesOnce` + arquivos em `routes/`.  
**Auth central:** `lib/api-auth.js` — JWT Bearer; `org_id` body/query = **contexto**; `user_id` body **ignorado** se ≠ JWT (log).  
**LIVE HTTP produção:** NÃO COMPROVADO neste ciclo (exceto histórico de QA/health).

`orgRequired: false` só em `GET /api/integracoes-status` (qualquer membership).

---

| Método | Path | Arquivo | Auth | Permission | Admin/service | Notas |
|--------|------|---------|------|------------|---------------|-------|
| GET | `/api/health` | server.js | nenhuma | — | não | ok público |
| POST | `/api/copiloto` | copiloto.js | staff | `ia:copilot` | via AI | |
| POST | `/api/preco` | preco.js | staff | `ia:assist` | | rascunho; não grava preço |
| POST | `/api/marketing` | marketing.js | staff | `ia:assist` | | |
| POST | `/api/ocr` | ocr.js | staff | `ia:assist` | Vision opcional | |
| POST | `/api/estoque` | estoque.js | staff | `ia:assist` | | IA estoque, não CRUD |
| POST | `/api/estudo-caso-pergunta` | … | staff | `ia:assist` | | |
| POST | `/api/estudo-caso-esclarecer` | … | staff | `ia:assist` | | |
| POST | `/api/discussao-caso` | … | staff | `ia:assist` | | |
| POST | `/api/protocolo` | protocolo.js | staff | `ia:assist` | | **texto IA**, não aplicado |
| POST | `/api/pele` | pele.js | staff | `ia:assist` | | |
| POST | `/api/skincare` `/api/skincare-ai` | skincare.js | staff | `ia:assist` | | rascunho |
| POST | `/api/analise-pele` | analise-pele.js | **token portal** | — | **service role** | RPC submit; **não** JWT staff |
| POST | `/api/analise-pele-fotos` | … | staff | `clientes:view` | admin | URLs |
| POST | `/api/analise-pele-portal-list` | … | token | — | admin | select sem ia_preliminar |
| POST/GET | `/api/calendario-conteudo` | … | cron **ou** staff | `dashboard:view` | | |
| POST | `/api/webhook-transacoes` | … | `WEBHOOK_TRANSACTIONS_SECRET` | — | service role | fail-closed se secret vazio (401). Org via `contas_vinculadas` |
| POST | `/api/create-portal-session` | … | staff | (ver arquivo) | admin | grava hash |
| POST | `/api/send-invite-email` | … | staff | `team:invite` | | |
| GET/POST | `/api/lembretes-auto` | … | cron **ou** staff `dashboard:view` | | **todas as clínicas no cron** | |
| POST | `/api/whatsapp-send` | … | staff | `whatsapp:send` | | |
| GET | `/api/integracoes-status` | … | JWT + qualquer org | orgRequired false | | booleanos de env, não secrets |
| GET | `/api/google-calendar/auth` | … | staff | `dashboard:view` | | |
| GET | `/api/google-calendar/callback` | … | OAuth `state` assinado | — | admin | sem JWT |
| GET | `/api/google-calendar/status` | … | staff | `dashboard:view` | admin | |
| POST | `/api/google-calendar/sync` | … | staff | `dashboard:view` | admin | ownership **código existe; E2E NÃO COMPROVADO** |
| POST | `/api/google-calendar/disconnect` | … | staff | `dashboard:view` | admin | |

CRUD de clientes/agenda/financeiro/estoque **não passa por estas APIs** — vai direto ao Supabase no browser.

---

## Fail-open / fail-closed (P0)

| Situação | Comportamento no código |
|----------|-------------------------|
| Sem JWT | 401 |
| Org sem membership | 403 |
| Erro DB permissões (não “tabela inexistente”) | 500 (fail-closed) |
| Tabela `organization_user_permissions` inexistente | **override=null → decide pela role** = **FAIL-OPEN relativo ao catálogo** |
| Webhook sem env secret | 401 |
| Cron sem `CRON_SECRET` | `isCronAuthorized` false |

Testes unitários: `scripts/test-p0-01-auth.js` (helpers, webhook mock, OAuth state). **Não** substitui teste live multi-tenant.
