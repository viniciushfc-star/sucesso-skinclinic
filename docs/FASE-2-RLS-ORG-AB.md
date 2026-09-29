# Fase 2 — RLS Org A ≠ Org B

**DATA:** 2026-09-29T14:17:03.998Z  
**Leitura:** Postgres/Storage PASS neste ciclo. APIs HTTP 500 (esperava 403) → isolamento de API **não** aprovado. RPC `get_analises_pele_by_token` ainda 42601.

**Ator:** JWT QA_EMAIL_MASTER (anon key)
**Orgs do JWT:** 2
**Outras orgs no projeto:** 10

- organizations_live=12
- jwt_orgs=2 roles=master,master
- outras_orgs=10

## Resultados

| Caso | Status | Detalhe |
|------|--------|---------|
| `clients` | PASS | linhas_visiveis=11 leak_org_b=0 |
| `agenda` | PASS | linhas_visiveis=1 leak_org_b=0 |
| `financeiro` | PASS | linhas_visiveis=11 leak_org_b=0 |
| `estoque_entradas` | PASS | linhas_visiveis=7 leak_org_b=0 |
| `protocolos_aplicados` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `analise_pele` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `client_sessions` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `audit_logs` | PASS | linhas_visiveis=50 leak_org_b=0 |
| `organization_invites` | PASS | linhas_visiveis=13 leak_org_b=0 |
| `profiles` | PASS | visiveis=0 leak_user_outra_org=0 |
| `ocr_notas` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `market_radar_refs` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `lgpd_requests` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `api_error_events` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `agenda_google_events` | PASS | tabela ainda não existe no live (migration pendente) |
| `google_calendar_connections` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `whatsapp_logs` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `ai_usage_events` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `client_events` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `anamnesis_registros` | PASS | linhas_visiveis=3 leak_org_b=0 |
| `orcamentos` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `estoque_produtos` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `client_packages` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `package_consumptions` | PASS | tabela ainda não existe no live (migration pendente) |
| `estoque_consumo` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `agenda_waitlist` | PASS | linhas_visiveis=0 leak_org_b=0 |
| `clients.eq_id` | PASS | sem linha na org B (clients) |
| `agenda.eq_id` | PASS | sem linha na org B (agenda) |
| `financeiro.eq_id` | PASS | sem linha na org B (financeiro) |
| `estoque_entradas.eq_id` | PASS | sem linha na org B (estoque_entradas) |
| `analise_pele.eq_id` | PASS | sem linha na org B (analise_pele) |
| `protocolos_aplicados.eq_id` | PASS | sem linha na org B (protocolos_aplicados) |
| `clients.insert_org_b` | PASS | negado 42501 |
| `api.copiloto.org_b` | FAIL | HTTP 500 (esperava 403; conferir deploy) |
| `api.preco.org_b` | FAIL | HTTP 500 (esperava 403; conferir deploy) |
| `api.marketing.org_b` | FAIL | HTTP 500 (esperava 403; conferir deploy) |
| `api.whatsapp-send.org_b` | FAIL | HTTP 500 (esperava 403; conferir deploy) |
| `api.audit-log.org_b` | FAIL | HTTP 500 (esperava 403; conferir deploy) |
| `api.create-portal-session.org_b` | FAIL | HTTP 500 (esperava 403; conferir deploy) |
| `rpc.get_client_session_by_token` | PASS | sem sessão |
| `rpc.get_client_by_token` | PASS | sem sessão |
| `rpc.get_analises_pele_by_token` | PASS | vazio/erro 42601 |
| `storage.list.analise-pele-fotos` | PASS | itens=0 pastas_org_b=0 |
| `storage.download.analise-pele-fotos` | PASS | sem pasta org B para testar |
| `storage.list.client-photos` | PASS | itens=1 pastas_org_b=0 |
| `storage.download.client-photos` | PASS | sem pasta org B para testar |
| `storage.list.anamnese-fotos` | PASS | itens=1 pastas_org_b=0 |
| `storage.download.anamnese-fotos` | PASS | sem pasta org B para testar |

**PASS:** 42  **FAIL/BLOQUEADO:** 6

Isolamento **não** aprovado neste ciclo.
