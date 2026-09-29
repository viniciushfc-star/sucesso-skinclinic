# Confronto Git × live — 2026-09-27T00:43:39

Host: `ipaayevpoqllucltvuhj.supabase.co`. Service role = existência. JWT master = SELECT da org. **Não grava.**

## Tabelas: 70 existem / 0 ausentes / 0 outros (de 70)

### Núcleo (precisa existir)

- `organizations`: **EXISTE** n=12
- `organization_users`: **EXISTE** n=13
- `organization_user_permissions`: **EXISTE** n=0
- `clients`: **EXISTE** n=4
- `agenda`: **EXISTE** n=3
- `procedures`: **EXISTE** n=7
- `financeiro`: **EXISTE** n=11
- `audit_logs`: **EXISTE** n=50

### Legado (pode existir sem o app escrever)

- `clientes`: **EXISTE** n=3
- `appointments`: **EXISTE** n=0
- `logs`: **EXISTE** n=2
- `assinaturas`: **EXISTE** n=0
- `convites`: **EXISTE** n=1

### Ausentes

_nenhuma_

### Com dado (count > 0)

- `organizations`: 12
- `organization_users`: 13
- `organization_invites`: 13
- `clients`: 4
- `clientes`: 3
- `agenda`: 3
- `appointment_confirmations`: 4
- `salas`: 2
- `procedures`: 7
- `estoque_entradas`: 7
- `sugestoes_estoque`: 2
- `financeiro`: 11
- `anamnesis_funcoes`: 8
- `notificacoes`: 4
- `whatsapp_logs`: 1
- `audit_logs`: 50
- `logs`: 2
- `afazeres`: 1
- `team_payment_models`: 1
- `api_error_events`: 35
- `convites`: 1

## Colunas que o código usa

| Tabela | Git | Status | Detalhe |
|--------|-----|--------|---------|
| `agenda.cancelled_at` | cancelamento | OK |  |
| `agenda.arrived_at` | sala espera | OK |  |
| `agenda.started_at` | sala espera | OK |  |
| `agenda.confirmed_at` | confirmacao | OK |  |
| `agenda.plano_id` | plano na agenda | OK |  |
| `agenda.sessao_plano` | plano na agenda | OK |  |
| `agenda.sessoes_plano` | plano na agenda | OK |  |
| `agenda.reminder_sent_at` | lembrete | OK |  |
| `clients.legacy_cliente_id` | merge clientes | OK |  |
| `clients.lgpd_erased_at` | LGPD | OK |  |
| `clients.consent_terms_accepted_at` | consentimento | OK |  |
| `client_sessions.token_hash` | portal | OK |  |
| `client_sessions.revoked_at` | portal | OK |  |
| `client_packages.orcamento_id` | ciclo ouro | OK |  |
| `package_consumptions.agenda_id` | baixa pacote | OK |  |
| `orcamentos.status` | orcamentos | OK |  |
| `orcamentos.items` | orcamentos | OK |  |
| `estoque_produtos.quantidade_minima` | lotes | OK |  |
| `estoque_consumo.lote` | lotes | OK |  |
| `estoque_consumo.motivo` | lotes | OK |  |
| `organizations.rateio_metodo` | rateio | OK |  |
| `organizations.cidade` | org perfil | OK |  |
| `organizations.nota_fiscal_emitir_url` | NFS URL avulso | OK |  |
| `financeiro.webhook_event_id` | webhook | OK |  |
| `audit_logs.acknowledged_at` | auditoria | OK |  |
| `google_calendar_connections.granted_scopes` | google | OK |  |
| `google_calendar_connections.reconnect_needed` | google | OK |  |
| `analise_pele.ia_preliminar` | pele interno | OK |  |
| `analise_pele.texto_validado` | pele portal | OK |  |
| `client_events.event_type` | CRM eventos | OK |  |

Colunas OK: 30/30. Falhas: 0.

## RPC portal (token lixo, service role)

- `get_client_session_by_token`: OK (vazio) — `` sem sessão
- `get_client_by_token`: OK (vazio) — `` sem sessão
- `get_analises_pele_by_token`: OK (vazio) — `42601` a column definition list is redundant for a function with OUT parameters

## Storage buckets

- `analise-pele-fotos`: EXISTE (privado) 
- `client-photos`: EXISTE (privado) 
- `anamnese-fotos`: EXISTE (privado) 
- `org-logos`: EXISTE (público) 

## Agenda → clients vs clientes

- amostra agenda=3, ids=1, em `clients`=1, em `clientes`=tabela erro invalid input syntax for type bigint: "eea2d6ff-e7ca-44f2-aba8-e83c41451b63"

## JWT master (SELECT org)

role=master org=true

- paciente (`clients`): vazio n=0 
- avaliacao (`analise_pele`): vazio n=0 
- anamnese (`anamnesis_registros`): vazio n=0 
- plano (`planos_terapeuticos`): vazio n=0 
- protocolo (`protocolos`): vazio n=0 
- aplicado (`protocolos_aplicados`): vazio n=0 
- estoque (`estoque_entradas`): vazio n=0 
- custo (`procedures`): vazio n=0 
- margem (`financeiro`): vazio n=0 
- crm (`agenda`): vazio n=0 
- orcamento (`orcamentos`): vazio n=0 
- pacote (`client_packages`): vazio n=0 
- eventos (`client_events`): vazio n=0 

## Ocupação (service role, 2026-09-27)

Papéis em `organization_users`: 11 master, 1 staff, 1 gestor. 11 orgs com membro; 12 orgs no total.

Todos os 4 `clients` e os 11 `financeiro` estão na mesma org. `agenda`: 1 linha com `org_id`+`cliente_id` UUID (bate em `clients`); **2 linhas com `org_id` e `cliente_id` nulos**.

JWT `QA_EMAIL_MASTER` lê a **primeira** membership: SELECT dos elos voltou n=0. O dado operacional não está nessa org — schema ok, **amostra clínica vazia no login de QA**.

Tabelas Git com n=0 (schema existe, fluxo ainda não usado no live): `organization_user_permissions`, `organization_access_requests`, `organization_legal_documents`, `profiles`, `client_events`, `client_sessions`, `client_records`, `client_protocols`, `client_packages`, `package_consumptions`, `client_evolution_photos`, `appointments`, `agenda_config`, `agenda_waitlist`, `external_calendar_blocks`, `procedure_categories`, `procedure_stock_usage`, `professional_procedures`, `planos_terapeuticos`, `planos_terapeuticos_procedimentos`, `protocolos`, `protocolos_descartaveis`, `protocolos_aplicados`, `estoque_consumo`, `estoque_produtos`, `contas_a_pagar`, `financeiro_metas`, `participacao_lucros`, `contas_vinculadas`, `fiscal_documents`, `fiscal_apuracoes`, `anamnesis_registros`, `analise_pele`, `skincare_rotinas`, `estudo_casos`, `message_templates`, `conteudo_calendario`, `copiloto_chat`, `precificacao_ia`, `marketing_ia`, `protocolos_ia`, `ai_usage_events`, `lgpd_requests`, `ocr_notas`, `market_radar_refs`, `agenda_google_events`, `google_calendar_connections`, `assinaturas`, `orcamentos`.

`clientes` legado: `id` bigint — UUID da agenda **não** entra nessa tabela (esperado). App canônico = `clients`.

## Como ler

- AUSENTE no núcleo = código novo contra banco velho.
- COLUNA_AUSENTE = cole o SQL Git/`-colar.sql` correspondente.
- RPC 42883 = função live com assinatura diferente do Git.
- Legado EXISTE = ok se o app não escrever (appointments/clientes).