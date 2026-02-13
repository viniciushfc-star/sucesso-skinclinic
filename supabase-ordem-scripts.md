# Ordem sugerida dos scripts SQL (Supabase)

Use esta ordem para evitar erros de coluna inexistente ou FK quebrada.

## Base (organizations, clientes, portal)

1. **supabase-fix-client-sessions-column.sql** – garante `client_id` em `client_sessions`
2. **supabase-client-registration-portal.sql** – portal do cliente, `get_client_session_by_token`

## Anamnese e análise de pele

3. **supabase-anamnese-canon.sql** – cria `anamnesis_funcoes` e **`anamnesis_registros`** (obrigatório antes do próximo)
4. **supabase-anamnese-ficha-fotos.sql** – colunas extras em `anamnesis_registros` (opcional)
5. **supabase-analise-pele-ia.sql** – tabela `analise_pele`, RPCs, RLS

Se rodar o passo 5 **antes** do 3, o bloco que adiciona colunas em `analise_pele` pode falhar ao criar a FK para `anamnesis_registros`, e nenhuma coluna nova (incluindo `consentimento_imagens`) é criada. Nesse caso: rode o passo 3 e depois o 5 de novo, ou use **supabase-analise-pele-add-columns.sql** para só adicionar as colunas que faltam.

## Rotina de skincare (portal)

6. **supabase-skincare-rotina.sql** – tabela `skincare_rotinas`, RLS, RPC `get_skincare_rotina_by_token` (portal). Depende de `organizations` e `clients` (ou `clientes`).

## Outros (conforme necessidade)

- **supabase-menu-settings.sql** – visibilidade do menu Anamnese
- **supabase-organization-profile.sql** – perfil da organização
- **supabase-estoque-canon.sql**, **supabase-calendario-conteudo.sql**, etc. – conforme o projeto
- **supabase-produto-avaliacoes.sql** – avaliações de produtos pelos profissionais (índice de cuidado). Rode após estoque e RLS organizations.
- **supabase-organization-user-permissions.sql** – overrides de permissão por usuário (tela Equipe → configurar permissões). Rode após RLS organizations.
- **supabase-appointment-confirmations.sql** – confirmação de horário por link (WhatsApp/portal). Tabela + RPC `confirm_appointment_by_token`. Rode após agenda/organizations.
- **supabase-documentos-termos.sql** – tabela `organization_legal_documents` para política de privacidade, termo LGPD, política de cancelamento e contrato de prestação de serviços. Essencial para defesa judicial. Rode após RLS organizations.
