# Fase 2 — RLS Org A ≠ Org B

**DATA:** 2026-09-21T02:09:21.942Z
**Ator:** JWT QA_EMAIL_MASTER (anon key)
**Orgs do JWT:** 1
**Outras orgs no projeto:** 11

- organizations_live=12
- jwt_orgs=1 roles=master
- outras_orgs=11

## Resultados

| Caso | Status | Detalhe |
|------|--------|---------|
| `clients` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `agenda` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `financeiro` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `estoque_entradas` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `protocolos_aplicados` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `analise_pele` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `client_sessions` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `audit_logs` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `organization_invites` | PASS | linhas_visiveis=13 leak_org_b=0 |
| `profiles` | PASS | visiveis=0 leak_user_outra_org=0 |
| `clients.eq_id` | PASS | negado (vazio) |
| `agenda.eq_id` | PASS | negado (vazio) |
| `financeiro.eq_id` | PASS | negado (vazio) |
| `estoque_entradas.eq_id` | PASS | negado (vazio) |
| `analise_pele.eq_id` | PASS | sem linha na org B (analise_pele) |
| `protocolos_aplicados.eq_id` | PASS | sem linha na org B (protocolos_aplicados) |
| `clients.insert_org_b` | PASS | negado 42501 |
| `api.copiloto.org_b` | FAIL | HTTP 500 (status errado; deploy do api-auth pode faltar — não é prova de vazamento) |
| `storage.list.analise-pele-fotos` | PASS | itens=0 pastas_org_b=0 |
| `storage.download.analise-pele-fotos` | PASS | sem pasta org B para testar |
| `storage.list.client-photos` | PASS | itens=0 pastas_org_b=0 |
| `storage.download.client-photos` | PASS | negado {} |
| `storage.list.anamnese-fotos` | PASS | itens=0 pastas_org_b=0 |
| `storage.download.anamnese-fotos` | PASS | sem pasta org B para testar |

**PASS:** 23  **FAIL/BLOQUEADO:** 1

## Interpretação (SQL 20260921140000 aplicado)

- **`audit_logs` PASS.** A policy `app.org_id` saiu. SELECT com JWT da org A **não** lista logs das outras 11 orgs.
- IDOR por id: `clients`, `agenda`, `financeiro`, `estoque_entradas` → vazio.
- INSERT `clients` na org B → 42501.
- Storage: list sem pastas alheias; download `client-photos` negado.
- **Único FAIL:** `POST /api/copiloto` com `org_id` da org B na Vercel → **500** (deveria ser 403). Não é vazamento observado neste teste. Corrige com **deploy** do `lib/api-auth.js` atual.

Isolamento **tabelas + insert + list storage** nesta bateria: **aprovado para o ator QA master**.  
Ainda **não** READY FOR PILOT: RPC portal, download de objeto real em todos os buckets, e API 403 no deploy.
