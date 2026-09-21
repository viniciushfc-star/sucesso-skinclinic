# Mapa definitivo do banco SkinClinic — 2026

**Não executar migrations nesta etapa.**

## Diagnóstico

O banco **não é fonte única de verdade no Git**.

| Fonte | O que é |
|-------|---------|
| `supabase/migrations/` (3) | Patches P0/P1: convite/financeiro RLS, portal/IA/calendar/`ai_usage_events`, token hash + storage + whatsapp_logs |
| `supabase/supabase-*.sql` (~88) | Day-1 real: CREATE/ALTER/RPC/RLS em ordem humana |
| Projeto live | Desconhecido sem dump |

`docs/FALTA-NO-BANCO.md` e `docs/INTERLIGACAO.md` **mentem em trechos** (ex.: `organization_invites` tem CREATE em `supabase-falta-no-banco.sql`).

---

## Tabelas com CREATE no repositório (alvo do mapa)

### Tenant / acesso
- `organizations` — ALTER/RLS; CREATE base **não** nas migrations oficiais  
- `organization_users`  
- `organization_invites` (`supabase-falta-no-banco.sql`)  
- `organization_user_permissions`  
- `organization_legal_documents`  
- `organization_access_requests` (código `organization.service.js`; CREATE a confirmar)  
- `profiles` (`tabelas-base` / falta-no-banco) — **RLS SELECT true = risco**  
- `google_calendar_connections`  
- `ai_usage_events` (migration P1)

### Operação
- `agenda` (`tabelas-base`)  
- `agenda_config`, `salas`, `professional_procedures`, `external_calendar_blocks`  
- `agenda_waitlist` (dup: crm-waitlist + rodar-agora)  
- `appointment_confirmations`  
- `procedures`, `procedure_categories`, `procedure_stock_usage`  
- `planos_terapeuticos`, `planos_terapeuticos_procedimentos`  
- `protocolos`, `protocolos_descartaveis`, `protocolos_aplicados`  
- `clients`, `client_events`, `client_sessions`, `client_records`, `client_protocols`, `client_packages`, `package_consumptions`, `client_evolution_photos`  
- `anamnesis_funcoes`, `anamnesis_registros`, `anamnesis_tipos`, `anamnesis_funcao_tipo`, `anamnesis_regras`, `anamnesis_catalogos`, `anamnesis_audit_log`, `anamnesis_assinaturas`, `anamnesis_campos_personalizados`  
- `analise_pele`, `skincare_rotinas`  
- `estudo_casos`, `estudo_caso_perguntas`

### Estoque / $ 
- `estoque_entradas`, `estoque_consumo`  
- `financeiro`, `contas_a_pagar`, `financeiro_metas`, `participacao_lucros`, `contas_vinculadas`  
- `fiscal_documents`, `fiscal_apuracoes` (dup scripts)

### Relacionamento / IA logs
- `notificacoes`, `message_templates`, `conteudo_calendario`, `produto_avaliacoes`  
- `whatsapp_logs`  
- `audit_logs`  
- `afazeres`, `team_payment_models`  
- `copiloto_chat`, `precificacao_ia`, `marketing_ia`, `protocolos_ia` (CREATE em falta-no-banco / uso no FE)

### Órfãos / duplicatas no **código**
- `appointments` — usado em `appointments.service.js`; **sem CREATE encontrado** nesta auditoria  
- `clientes` — fallback métricas/anamnese  
- `convites` — comentado em `user.service.js`  
- `logs` — `logs.service.js` deprecated  
- `assinaturas` — `limits.service.js`  
- `sugestoes_estoque` — insert em estoque.views

---

## RPCs (portal / público / estoque)

| RPC | Script típico |
|-----|----------------|
| `get_client_session_by_token` | portal + **migrations 20260914 e 20260920** (hash) |
| `get_client_by_token` | idem |
| `create_client_portal_session` | portal-completo / criar-create |
| `client_complete_registration` | portal / consent termo |
| `client_sign_consent_only` | consent-signature |
| `submit_anamnese_by_token` / `list_anamnese_portal_by_token` | anamnese-portal |
| `submit_analise_pele` / `get_analises_pele_by_token` | analise-pele (+ p0-02 privacidade) |
| `get_skincare_rotina_by_token` | skincare-rotina |
| `list_portal_*` / `create_portal_appointment` / reschedule / cancel | portal-agendamento |
| `get_public_clinic` / `list_public_*` / `create_public_appointment` | agenda-publica |
| `confirm_appointment_by_token` | appointment-confirmations |
| `report_client_event` | clients-and-events |
| `estoque_consumo_ao_aplicar_protocolo` | **trigger** protocolo-canon |
| `is_master_for_org` | financeiro-master |
| `set_config` | rls-clients-drop-all |

**Conflito:** três versões de `get_client_session_by_token` (plaintext vs hash). Canônico **código+migration 20260920**: hash + fallback plaintext legado.

---

## Triggers

- Consumo ao aplicar protocolo (`estoque_consumo_ao_aplicar_protocolo`)  
- `updated_at` em vários módulos  

---

## Storage (evidência)

- `client-photos`, `anamnese-fotos` — privados na migration 20260920  
- `org-logos` — URL pública no `organization-profile.service.js`  
- Análise de pele: buckets tratados em `supabase-diagnostico-compatibilidade.sql`

---

## RLS — padrão e falhas no SQL

Padrão: `org_id IN (SELECT org_id FROM organization_users WHERE user_id = auth.uid())`.

**Falhas documentadas no SQL (não “live”):**
- `profiles` SELECT all authenticated (`tabelas-base.sql`)  
- Membership insert: corrigido na migration P0 **se aplicada**  
- RPC SECURITY DEFINER: isolamento depende do `org_id` derivado do **token**, não do body  

**Não há** RLS de `appointments` no repo se a tabela só existir no live.

---

## Mapa alvo (quando for hora de migrar)

Uma baseline `CREATE` ordenada:

1. auth helpers + organizations + organization_users  
2. permissions + invites  
3. clients + events + sessions  
4. agenda + procedures + salas  
5. financeiro  
6. estoque + protocolos  
7. anamnese + pele + skincare  
8. CRM waitlist + notificacoes  
9. audit + ai_usage  
10. resto  

Depois: `pg_dump --schema-only` do live como verdade, diff contra o Git.

**Não criar tabela “misteriosa” no Dashboard.**
