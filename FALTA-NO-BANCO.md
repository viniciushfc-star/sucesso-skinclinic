# O que falta no banco (Supabase)

Resumo do que o app usa e **não** é criado por nenhum script SQL deste repositório, ou que depende de você rodar scripts na ordem certa.

---

## 1. Tabelas que **não têm** CREATE no repositório

Estas o app usa, mas **não existe** um `CREATE TABLE` em nenhum `.sql` da pasta. Você precisa criá-las no Supabase (ou rodar o script sugerido abaixo).

| Tabela | Onde o app usa | Observação |
|--------|----------------|------------|
| **organization_invites** | Convites (Convidar usuário, lista em Configurações, aceitar convite) | Colunas esperadas: `id` (uuid), `organization_id` (uuid), `email` (text), `role` (text), `status` (text, ex: 'pending', 'accepted'). |
| **client_records** | Portal do cliente ("Orientações recentes"), prontuário, `client-records.service.js` | Registros compartilhados com o cliente. Pode ter: `id`, `org_id`, `client_id`, `protocol_id` (opcional), `record_type`, `content` (jsonb ou text), `visibility`, `created_at`. |
| **client_protocols** | Portal do cliente (tratamento ativo) | Pode ser uma **view** sobre protocolos do cliente, ou tabela. O portal faz `.select("*").eq("status", "active").single()`. |
| **profiles** | Equipe (nomes), perfil do usuário | O app usa `profiles.id` e `profiles.nome`. Muitos projetos Supabase criam `profiles` ligado a `auth.users`. Se não existir, a equipe mostra "Profissional" no lugar do nome. |
| **sugestoes_estoque** | Estoque (uma inserção em `estoque.views.js`) | Tabela de sugestões; se não existir, essa ação falha. |
| **notificacoes** | Agenda (avisos, “Agendamentos sem responsável”) | Inserção e leitura. Colunas esperadas: `id`, `lida` (bool), `titulo` (text), etc. |
| **agenda** | Agenda (agendamentos) | Vários scripts só fazem **ALTER TABLE agenda** (colunas, RLS). A tabela base pode ter sido criada em outro projeto ou script antigo. |
| **financeiro** | Financeiro (transações) | Idem: só há scripts que adicionam colunas; não há `CREATE TABLE financeiro` no repo. |
| **organizations** | Org ativa, configurações | Só há RLS e ALTER; a tabela é base do onboarding. |
| **organization_users** | Equipe, permissões, org ativa | Só há RLS; a tabela é base do onboarding. |
| **copiloto_chat** | Copiloto (IA) | Histórico de chat. |
| **precificacao_ia** | Preço (IA) | Log/sugestões. |
| **marketing_ia** | Marketing (IA) | Log/sugestões. |
| **protocolos_ia** | Protocolo (IA) | Log/sugestões. |
| **whatsapp_logs** | WhatsApp | Log de envios. |

---

## 2. RPCs (funções) usadas pelo portal do cliente

Se o portal do cliente for usado, estas funções precisam existir no banco:

| RPC | Script que cria |
|-----|------------------|
| `get_client_session_by_token` | `supabase-portal-cliente-completo.sql` ou `supabase-client-registration-portal.sql` |
| `get_client_by_token` | Idem |
| `client_complete_registration` | Idem |
| `client_sign_consent_only` | `supabase-client-consent-signature.sql` |
| `report_client_event` | `supabase-clients-and-events.sql` ou `supabase-campos-clientes.sql` |
| `confirm_appointment_by_token` | `supabase-appointment-confirmations.sql` |
| `get_analises_pele_by_token` | `supabase-analise-pele-ia.sql` |
| `get_skincare_rotina_by_token` | `supabase-skincare-rotina.sql` |
| `create_client_portal_session` | `supabase-portal-cliente-completo.sql` ou `supabase-criar-create-client-portal-session.sql` |
| `set_config` | `supabase-rls-clients-drop-all.sql` (opcional, para o portal) |

---

## 3. Ordem sugerida para rodar os scripts existentes

Para ter o mínimo de tabelas e RLS que o app espera, uma ordem possível (ajuste se o seu projeto já tiver parte disso):

1. **Base org e usuários**  
   - `supabase-rls-organizations.sql` (RLS em `organizations` e `organization_users`; as tabelas em si costumam vir do Supabase Auth / outro script base).

2. **Clientes e portal**  
   - `supabase-clients-and-events.sql` ou `supabase-campos-clientes.sql` (clients/client_events/client_sessions)  
   - `supabase-portal-cliente-completo.sql` (client_sessions + RPCs do portal)

3. **Agenda e financeiro**  
   - Scripts que criam/alteram `agenda` e `financeiro` (ex.: `supabase-agenda-modelo.sql`, `supabase-agenda-uuid-columns.sql`, `supabase-rls-agenda.sql`, `supabase-financeiro-*.sql`).  
   - Se `agenda` e `financeiro` não existirem, será preciso um script base que as crie (fora do repo).  
   - **`supabase-pacotes-sessoes.sql`**: cria `client_packages` e `package_consumptions` (pacotes de sessões por cliente; usado na aba Pacotes do perfil do cliente).

4. **Anamnese**  
   - `supabase-anamnese-canon.sql`  
   - `supabase-anamnese-ficha-fotos.sql`  
   - **`supabase-anamnese-modular.sql`** (inclui resultado_resumo, anamnesis_campos_personalizados, etc.)

5. **Auditoria, equipe, salas, estoque, etc.**  
   - `supabase-audit-logs-create-and-rls.sql`  
   - `supabase-equipe-canonico.sql` (team_payment_models, afazeres)  
   - `supabase-salas-respiro.sql` (salas, agenda_config, afazeres)  
   - `supabase-google-calendar-connections.sql`  
   - Demais scripts conforme a funcionalidade que for usar.

---

## 4. Script para criar só o que não existe no repo

Foi criado o arquivo **`supabase-falta-no-banco.sql`** com:

- `organization_invites` (tabela + RLS básico)
- Comentários sobre `client_records` e `client_protocols` (você pode criar views/tabelas conforme sua regra)

Rode esse script no SQL Editor do Supabase **depois** de ter `organizations` e `organization_users` (e auth) configurados.

---

## 5. Resumo rápido

- **Falta criar (não há script no repo):**  
  **organization_invites** (obrigatório para convites).  
  **client_records** e **client_protocols** (obrigatório para portal “Orientações” e “tratamento ativo”).  
  **profiles** (recomendado para nomes na equipe).  
  **sugestoes_estoque**, **notificacoes** (se usar essas telas).  
  Tabelas de IA (copiloto_chat, precificacao_ia, marketing_ia, protocolos_ia) e **whatsapp_logs** (se usar esses recursos).

- **Depende de rodar scripts na ordem:**  
  Base (organizations, organization_users, clients/clientes, agenda, financeiro), portal, anamnese modular, auditoria, equipe, salas, etc., como na seção 3.

- **Portal do cliente:**  
  Rodar os scripts que criam `client_sessions` e as RPCs listadas na seção 2.
