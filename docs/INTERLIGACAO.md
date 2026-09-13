# Interligação – checklist do que depende de tabelas/SQL

Este documento lista o que o app espera do Supabase e o que pode estar faltando ou desencontrado.

---

## ✅ Corrigido nesta sessão

- **Convites / Configurações (master):** a lista de convites pendentes e o botão "Aprovar" passaram a usar a tabela **`organization_invites`** (em vez de `convites`). Aprovar faz `update status = 'accepted'` na mesma tabela.
- **Aceitar convite (org.js):** foram implementados **`linkUserToOrganization`** e **`markInviteAsAccepted`** em `org.service.js` e importados em `org.js`, para o fluxo "Aceitar convite" funcionar sem RPC `approve_invite`.
- **Equipe (getTeam):** `user.service.js` → **getTeam()** passou a listar **`organization_users`** (membros da org), em vez de `convites`. E-mail/nome para exibição podem vir de **`profiles`** (se existir e tiver `nome`/email); senão o card mostra "Profissional".

---

## Tabelas / views que o app usa e onde são criadas

| Recurso | Onde criar / Observação |
|--------|--------------------------|
| **organization_invites** | Não há script SQL no repo. Se não existir, convites (Convidar + lista em Configurações) falham. Crie com colunas: `id`, `organization_id` (ou `org_id`), `email`, `role`, `status` ('pending' / 'accepted'). |
| **organization_users** | `supabase-rls-organizations.sql` e outros. Base da equipe e permissões. |
| **client_records** | **Não há script no repo.** Usado pelo portal do cliente e por `client-records.service.js` (prontuário). Se não existir, "Orientações recentes" no portal e prontuário que usam essa tabela falham. |
| **client_protocols** | **Não há script no repo.** Portal usa `.from("client_protocols")` para "tratamento ativo". Pode ser view sobre `protocolos`/clientes ou tabela dedicada. |
| **profiles** | Muitas views usam `profiles` (nome, e-mail). Não há `CREATE TABLE profiles` nos SQLs do repo; pode ser criado manualmente ou por outro projeto. Sem isso, nomes na equipe podem ficar vazios ou "Profissional". |
| **anamnesis_*** | `supabase-anamnese-canon.sql`, `supabase-anamnese-ficha-fotos.sql`, **`supabase-anamnese-modular.sql`** (inclui `resultado_resumo`, `anamnesis_campos_personalizados`, etc.). Rodar o modular evita 400/404 em anamnese. |
| **audit_logs** | `supabase-audit-logs-create-and-rls.sql`. |
| **client_sessions** | Portal do cliente. Vários scripts: `supabase-portal-cliente-completo.sql`, `supabase-client-registration-portal.sql`, etc. |
| **google_calendar_connections** | `supabase-google-calendar-connections.sql`. |
| **set_config** | RPC usada pelo portal. Ex.: `supabase-rls-clients-drop-all.sql`. |

---

## RPCs usadas pelo portal do cliente

- `get_client_session_by_token`
- `get_client_by_token`
- `client_complete_registration`
- `client_sign_consent_only`
- `report_client_event`
- `confirm_appointment_by_token`
- `get_analises_pele_by_token`
- `get_skincare_rotina_by_token`
- `set_config` (opcional)

Scripts que definem várias delas: **`supabase-portal-cliente-completo.sql`**, **`supabase-client-registration-portal.sql`**, **`supabase-appointment-confirmations.sql`**, **`supabase-analise-pele-ia.sql`**, **`supabase-skincare-rotina.sql`**.

---

## clients vs clientes

O código usa **`clients`** e **`clientes`** em pontos diferentes (ex.: agenda, métricas, clientes.service). Pode ser intencional (dois esquemas ou migração). Confira no seu Supabase qual tabela existe e se as views/rotas certas apontam para ela.

---

## O que rodar no Supabase para evitar 400/404

1. **Anamnese:** rodar **`supabase-anamnese-modular.sql`** (cria/atualiza colunas em `anamnesis_registros`, tabelas de regras, catálogos, **resultado_resumo**, **anamnesis_campos_personalizados**, etc.).
2. **Portal e convites:** ter **`client_sessions`**, **`organization_invites`** (e RPCs do portal) criados. Se `organization_invites` não existir, crie a tabela com as colunas acima.
3. **Portal “Orientações recentes” e “tratamento ativo”:** criar **`client_records`** e **`client_protocols`** (ou views equivalentes) conforme a regra de negócio desejada.

---

## Resumo

- **Já interligado no código:** convites/organization_invites, aceitar convite (org.js), lista da equipe (getTeam).
- **Depende do banco:** tabelas `organization_invites`, `client_records`, `client_protocols`, `profiles` (e scripts do portal/anamnese) precisam existir no Supabase para as telas que as usam funcionarem sem erro.
