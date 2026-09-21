# Fase 2 — RLS Org A ≠ Org B

**DATA:** 2026-09-21T02:21:12.915Z
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
| `api.copiloto.org_b` | PASS | HTTP 403 |
| `api.preco.org_b` | PASS | HTTP 403 |
| `api.marketing.org_b` | PASS | HTTP 403 |
| `api.whatsapp-send.org_b` | PASS | HTTP 403 |
| `api.create-portal-session.org_b` | PASS | HTTP 403 |
| `rpc.get_client_session_by_token` | PASS | vazio/erro 42883 |
| `storage.list.analise-pele-fotos` | PASS | itens=0 pastas_org_b=0 |
| `storage.download.analise-pele-fotos` | PASS | sem pasta org B para testar |
| `storage.list.client-photos` | PASS | itens=0 pastas_org_b=0 |
| `storage.download.client-photos` | PASS | negado {} |
| `storage.list.anamnese-fotos` | PASS | itens=0 pastas_org_b=0 |
| `storage.download.anamnese-fotos` | PASS | sem pasta org B para testar |

**PASS:** 29  **FAIL/BLOQUEADO:** 0

## Interpretação (pós-deploy `26421aa`)

- Copiloto / preço / marketing / WhatsApp / portal-session com `org_id` da org B → **403**.
- `audit_logs` SELECT sem leak.
- IDOR por id nas tabelas com dado → vazio; insert org B → 42501.
- QA live Vercel: **1195 pass / 0 fail** (227 skip, 18 warn).
- RPC `get_client_session_by_token`: Postgres **42883** (assinatura/nome). Não vazou sessão; **não** prova o RPC canônico completo.
- Download de objeto em todos os buckets com prefixo real de org B: parcialmente coberto.

**Não** READY FOR PUBLIC LAUNCH. Isolamento desta bateria: **aprovado para o ator QA master** nas superfícies testadas.
