# Ordem sugerida dos scripts SQL (Supabase)

Use esta ordem para evitar erros de coluna inexistente ou FK quebrada.

## Base (organizations, clientes, portal)

1. **supabase-fix-client-sessions-column.sql** – garante `client_id` em `client_sessions`
2. **supabase-client-registration-portal.sql** – portal do cliente, `get_client_session_by_token`

## Anamnese e análise de pele

3. **supabase-anamnese-canon.sql** – cria `anamnesis_funcoes` e **`anamnesis_registros`** (obrigatório antes do próximo)
4. **supabase-anamnese-ficha-fotos.sql** – colunas extras em `anamnesis_registros` (opcional)
5. **supabase-analise-pele-ia.sql** – tabela `analise_pele`, RPCs, RLS
5b. **supabase-analise-pele-p0-02-privacidade.sql** – bucket privado + RPC do portal sem `ia_preliminar` (rode depois do 5)

Se rodar o passo 5 **antes** do 3, o bloco que adiciona colunas em `analise_pele` pode falhar ao criar a FK para `anamnesis_registros`, e nenhuma coluna nova (incluindo `consentimento_imagens`) é criada. Nesse caso: rode o passo 3 e depois o 5 de novo, ou use **supabase-analise-pele-add-columns.sql** para só adicionar as colunas que faltam.

## Rotina de skincare (portal)

6. **supabase-skincare-rotina.sql** – tabela `skincare_rotinas`, RLS, RPC `get_skincare_rotina_by_token` (portal). Depende de `organizations` e `clients` (ou `clientes`).
7. **supabase-anamnese-portal.sql** – anamnese preenchida pelo cliente no portal (`origem = portal`).
8. **supabase-tabelas-base.sql** – cria `agenda`, `financeiro`, `client_records`, etc. se ainda não existirem.
9. **supabase-portal-agendamento.sql** – cliente agenda, remarca e cancela pelo portal.
10. **supabase-agenda-publica.sql** – link público `/agendar.html?org=` (Instagram/WhatsApp).
11. **supabase-crm-waitlist.sql** – lista de espera, `google_review_url` e meta de fidelidade.
12. **supabase-rodar-agora.sql** – atalho: lembrete + espera + colunas da agenda (se ainda não rodou 10 e 11).
13. **supabase-fiscal-contador.sql** – pasta do contador, regime tributário e rascunhos de apuração.

14. **supabase-p0-rls-isolamento.sql** – fecha self-join em `organization_users`, RLS de `financeiro`, convite do próprio e-mail.
15. **supabase-p1-portal-ia-calendario.sql** – RPC do portal sem SETOF, last_used/revoked, calendário só do dono, tabela `ai_usage_events`.

A pasta `supabase/migrations/` replica P0/P1 em ordem de timestamp (fonte nova de patches de segurança).

## Diagnóstico (somente leitura)

- **supabase-diagnostico-compatibilidade.sql** — lista o que o app espera vs o que existe (OK / FALTA / ATENCAO). Não altera dados.

## Outros (conforme necessidade)

- **supabase-menu-settings.sql** – visibilidade do menu Anamnese
- **supabase-organization-profile.sql** – perfil da organização
- **supabase-estoque-canon.sql**, **supabase-calendario-conteudo.sql**, etc. – conforme o projeto
- **supabase-produto-avaliacoes.sql** – avaliações de produtos pelos profissionais (índice de cuidado). Rode após estoque e RLS organizations.
- **supabase-organization-user-permissions.sql** – overrides de permissão por usuário (tela Equipe → configurar permissões). Rode após RLS organizations.
- **supabase-appointment-confirmations.sql** – confirmação de horário por link (WhatsApp/portal). Tabela + RPC `confirm_appointment_by_token`. Rode após agenda/organizations.
- **supabase-documentos-termos.sql** – tabela `organization_legal_documents` para política de privacidade, termo LGPD, política de cancelamento e contrato de prestação de serviços. Essencial para defesa judicial. Rode após RLS organizations.