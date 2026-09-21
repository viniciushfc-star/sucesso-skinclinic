# Probe live do schema — 2026-09-21

Gerado por `scripts/schema-probe-live.js` (PostgREST head count).  
**Não** é pg_dump. Colunas, RLS e RPCs **não** são listados aqui.

Projeto URL host: `ipaayevpoqllucltvuhj.supabase.co`

## Existe no live (63)

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
- `google_calendar_connections`
- `assinaturas`
- `convites`

## Ausente no live (0)

_nenhuma_

## Outros

_nenhum_

## Contagens (ciclo 2)

Ver `docs/FASE-1-BANCO-CICLO.md`. Resumo: `appointments` 0 linhas; `clientes` 3 IDs **sem** interseção com `clients` (4).

## Interpretação

Todas as tabelas da lista de probe **existem** neste projeto live. Legado não está “ausente”: está **vazio ou paralelo**.
- `organization_user_permissions` **existe** → fail-closed de catálogo não derruba a API hoje.
