# Segurança das APIs (P0-01)

## 1. Como o JWT é validado

Rotas de **dashboard** (funcionários) leem `Authorization: Bearer <access_token>` da sessão Supabase.

`lib/api-auth.js` usa o cliente **anon** (`SUPABASE_URL` + `SUPABASE_ANON_KEY`) e `auth.getUser(token)`.

- Sem header ou token vazio → **401** `{ "error": "Não autenticado" }`
- Token inválido ou expirado (Supabase rejeita) → **401**

A identidade é **somente** `user.id` retornado pelo Supabase. `user_id` no body/query **não** autoriza; se divergir do JWT, o backend registra um warning e segue com o JWT.

## 2. Como o usuário é identificado

`authenticateRequest(req)` → `{ user, token }` com `user` do JWT.

Nunca: `req.body.user_id`, `req.query.userId`, role enviada pelo cliente.

## 3. Como org_id é validado

O frontend pode enviar `org_id` / `orgId` / `org` (contexto: “quero esta clínica”).

O backend chama `requireOrganizationMember(user.id, orgId)` em `organization_users` (via **SERVICE_KEY**, depois do JWT).

Sem linha user+org → **403** `{ "error": "Sem permissão" }`.

Master da org A **não** acessa a org B: o filtro é sempre `user_id` + `org_id`.

## 4. Como roles são verificadas

O `role` vem de `organization_users.role` no banco, não do frontend.

`master` tem acesso total **dentro da própria org**. Alias `staff` → `funcionario` (mesmo mapa do frontend).

## 5. Como permissions são verificadas

Mesma lógica conceitual de `js/core/permissions.js`:

1. Override em `organization_user_permissions` (se existir)
2. Senão, `ROLE_PERMISSIONS` em `js/core/permissions.map.js`

Exemplos:

- APIs de IA / OCR / estoque: `dashboard:view`
- `create-portal-session`: `clientes:view`
- `send-invite-email`: `team:invite`

Permissão de menu no frontend **não** substitui este check.

## 6. Quando SERVICE_KEY pode ser usada

Somente no **servidor**, após JWT + membership (+ permission quando aplicável).

Serve para consultas administrativas (copiloto, portal session, webhook, cron, Google Calendar).

Nunca: HTML, JS público, resposta JSON, logs de resposta, parâmetro de request.

## 7. Dashboard vs portal

| | Dashboard | Portal do cliente |
|---|---|---|
| Token | JWT Supabase Auth do funcionário | Token de `client_sessions` |
| Identidade | `auth.getUser(jwt)` | RPC `get_client_session_by_token` |
| Isolamento | `organization_users` | `client_id` + `org_id` **da sessão** |

`/api/analise-pele` **não** usa JWT de staff. `client_id` no body é ignorado.

## 8. Usuário vs webhook

`POST /api/webhook-transacoes` **não** usa JWT.

Exige header `x-webhook-secret` (ou `x-webhook-transactions-secret`) igual a `WEBHOOK_TRANSACTIONS_SECRET`.

Se o secret **não estiver configurado**, a rota recusa (401). Não fica aberta.

Idempotência do webhook: **não implementada nesta etapa** (tarefa separada).

## 9. Isolamento multi-tenant

1. JWT prova quem é o usuário  
2. Membership prova que ele está na org pedida  
3. Permission prova a operação  
4. Consultas com SERVICE_KEY filtram `org_id` autenticado  
5. RLS no Supabase continua obrigatório para o frontend (anon)

Alterar `org_id` no DevTools para outra clínica deve resultar em **403**.

## 10. APIs protegidas (dashboard)

JWT + membership (e permission indicada):

- `POST /api/copiloto`, `/preco`, `/marketing`, `/protocolo`, `/pele`, `/skincare`, `/skincare-ai`
- `POST /api/estoque`, `/ocr`, `/estudo-caso-pergunta`, `/estudo-caso-esclarecer`, `/discussao-caso`
- `POST /api/create-portal-session` (`clientes:view`)
- `POST /api/send-invite-email` (`team:invite`)
- `POST /api/whatsapp-send`
- `GET /api/integracoes-status` (JWT + qualquer membership)
- `GET|POST /api/lembretes-auto` (JWT+org **ou** `CRON_SECRET`)
- `GET|POST /api/calendario-conteudo?action=processar-agendados` (JWT+org **ou** cron)
- `GET /api/google-calendar/auth`, `status`
- `POST /api/google-calendar/sync`, `disconnect`

## APIs públicas (por desenho)

| Rota | Motivo |
|------|--------|
| `GET /api/health` | Probe de disponibilidade, sem dados |
| `GET /api/google-calendar/callback` | Callback OAuth do Google. Sem JWT (redirect do Google). O `state` é HMAC (`userId`+`orgId`+exp), assinado em `/auth`. Membership é revalidada antes de gravar a conexão. |
| `POST /api/analise-pele` | Token de sessão do **cliente**, não JWT staff |
| `POST /api/webhook-transacoes` | Segredo de máquina, não JWT |

HTML estático (`/`, `/dashboard.html`, `/portal.html`, etc.) não é API.

## CORS

`server.js` ecoa qualquer `Origin` presente.

**PENDÊNCIA: definir allowlist oficial de origins.** No repositório há indício de produção em `https://skinclinic-one.vercel.app`, mas não há lista fechada (custom domain, preview Vercel, localhost). Não foi inventada allowlist nesta correção.

## Rate limit (proposta, não implementada)

Endpoints de IA geram custo OpenAI e **não** têm rate limit nesta tarefa.

Proposta mínima: mapa em memória `userId+rota` com teto (ex. 20 req/min) em `lib/api-auth.js`, sem nova dependência. Não implementar agora.

## Frontend

Chamadas de staff devem usar `js/core/api-fetch.js` (`Authorization` + `org_id` da org ativa como contexto).
