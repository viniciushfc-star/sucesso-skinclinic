# Plano de testes SkinClinic 1.0

**Data:** 2026-09-20  
**Regra:** `npm test` verde **não** significa pronto.

---

## Camadas

| Camada | Hoje | Alvo |
|--------|------|------|
| Unit / contrato | p0-01, p0-02, p0-03, imports, catálogo | manter |
| Integration API | catálogo live opcional | staging obrigatório no CI |
| E2E | ausente | Playwright: login, org, agenda, cliente, portal |
| RLS | scripts SQL | ORG A não lê ORG B (todas as tabelas críticas) |
| Security | 403 em rotas POST | IDOR, token reuse, upload, payload, prompt injection |
| Domínio | ausente | finance, stock, pricing, CRM, permissions |
| Performance | ausente | budget de query e bundle |

## Matriz IDOR (obrigatória no piloto)

Trocar `org_id`, `user_id`, `client_id`, `protocol_id`, `appointment_id`/`agenda.id`, `stock_id`, `transaction_id`. Esperado: 401/403/vazio, nunca o registro do outro tenant.

Tokens: expirado, reutilizado, hash vs plaintext legado.  
Storage: path de outra org.  
Cache: resposta de A não pode servir B.  
Webhook: duplicata idempotente.  
Concorrência: dois protocolos aplicados no mesmo estoque.

## Ambientes

Local: migrations reset.  
Staging = clone do schema de produção.  
Produção: smoke pós-deploy (health + login), não suíte destrutiva.

## Definição de pronto para piloto

- P0-2 (RLS) com evidência anexada  
- E2E crítico verde em staging  
- Sem service role no frontend (grep CI)  
- Catálogo de permissão presente (fail-closed)

## O que o QA live de 1400 casos cobre

HTTP, métodos, páginas, alguns 403. **Não** cobre RLS, Storage, nem “A acessa B”.
