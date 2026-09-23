# Probe live do schema — 2026-09-23

Gerado por `scripts/schema-probe-live.js` (PostgREST head count).  
**Não** é pg_dump. Colunas, RLS e RPCs **não** são listados aqui.

Projeto URL host: `ipaayevpoqllucltvuhj.supabase.co`

## Existe no live (68)

- `organizations`
- `organization_users`
- `organization_invites`
- `organization_user_permissions`
- `organization_access_requests`
- `organization_legal_documents`
- `profiles`
- `clients`
- `clientes`
- `client_events`
- `client_sessions`
- `client_records`
- `client_protocols`
- `client_packages`
- `package_consumptions`
- `client_evolution_photos`
- `agenda`
- `appointments`
- `agenda_config`
- `agenda_waitlist`
- `appointment_confirmations`
- `external_calendar_blocks`
- `salas`
- `procedures`
- `procedure_categories`
- `procedure_stock_usage`
- `professional_procedures`
- `planos_terapeuticos`
- `planos_terapeuticos_procedimentos`
- `protocolos`
- `protocolos_descartaveis`
- `protocolos_aplicados`
- `estoque_entradas`
- `estoque_consumo`
- `sugestoes_estoque`
- `financeiro`
- `contas_a_pagar`
- `financeiro_metas`
- `participacao_lucros`
- `contas_vinculadas`
- `fiscal_documents`
- `fiscal_apuracoes`
- `anamnesis_funcoes`
- `anamnesis_registros`
- `analise_pele`
- `skincare_rotinas`
- `estudo_casos`
- `notificacoes`
- `message_templates`
- `conteudo_calendario`
- `whatsapp_logs`
- `audit_logs`
- `logs`
- `afazeres`
- `team_payment_models`
- `copiloto_chat`
- `precificacao_ia`
- `marketing_ia`
- `protocolos_ia`
- `ai_usage_events`
- `api_error_events`
- `lgpd_requests`
- `ocr_notas`
- `market_radar_refs`
- `agenda_google_events`
- `google_calendar_connections`
- `assinaturas`
- `convites`

## Ausente no live (0)

_nenhuma_

## Outros

_nenhum_

## Interpretação

Todas as tabelas da lista de probe **existem** neste projeto live, inclusive `ocr_notas`, `market_radar_refs` e `agenda_google_events`.
- `appointments` / `clientes` / `convites` / `logs` / `assinaturas`: legado paralelo, não ausente.
- `organization_user_permissions` existe → fail-closed de catálogo não derruba a API hoje.
