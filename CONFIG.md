# Configuração – SkinClinic

## Rodar com APIs conectadas (recomendado)

Para que o Copilot, Preço, Marketing, **link do portal do cliente** e demais funcionalidades de IA funcionem:

1. Copie `.env.example` para `.env` e preencha:
   - `OPENAI_KEY` — chave da OpenAI (Copilot, Preço, Marketing, etc.)
   - `SUPABASE_URL` — URL do projeto Supabase
   - `SUPABASE_SERVICE_KEY` — chave **service_role** do Supabase (nunca no frontend)
   - `SUPABASE_ANON_KEY` — chave **anon/public** do Supabase (para a API validar o JWT do usuário)
2. Na pasta do projeto: `npm install` e depois **`npm start`**.
3. Acesse **sempre** pelo navegador: **`http://localhost:3000`** (ou `http://localhost:3000/dashboard.html` após login).

O servidor Node (porta 3000) serve o frontend estático **e** as rotas `/api/*` no mesmo processo. Se você abrir o app por outro meio (Live Server, `npx serve` em outra porta, arquivo `file://`), a interface pode carregar mas as chamadas à API (portal do cliente, Copilot, etc.) vão para a porta 3000; por isso é essencial que **`npm start` esteja rodando** no terminal.

### Se der 404 no “Gerar link” do portal

- Significa que a requisição não encontrou a API. Faça o seguinte:
  1. No terminal, na pasta do projeto: **`npm start`**. Deve aparecer `Servidor rodando em http://localhost:3000` e **nenhuma** linha `Rota não carregada: /api/create-portal-session`.
  2. No navegador, abra **http://localhost:3000/api/health** — se aparecer `{"ok":true}` o servidor está de pé; se não carregar, a porta 3000 pode estar em uso ou o Node não subiu.
  3. Abra o app em **http://localhost:3000** e use (login → clientes → perfil → Gerar link). Não use Live Server nem abrir `index.html` direto.
  4. Se /api/health responde mas o portal ainda falha: no terminal, veja se apareceu `Rota não carregada: /api/create-portal-session`. Se sim, confira o .env (SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY) e a mensagem de erro completa ao rodar `npm start`.

## Rodar só o frontend (sem APIs)

1. Na pasta do projeto: `npx serve -c serve.json` (ou `npx serve . -l 3000`).
2. Acesse: `http://localhost:3000` (ou a porta que o serve mostrar).
3. O Copilot e demais funcionalidades de IA retornarão “não disponível” até que as APIs estejam configuradas.

## Supabase – conexão em localhost

Para login, Google e redefinição de senha funcionarem em **localhost**:

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard) do seu projeto.
2. Vá em **Authentication** → **URL Configuration**.
3. Em **Redirect URLs**, adicione:
   - `http://localhost:3000`
   - `http://localhost:3000/**`
   - E, se usar outra porta: `http://localhost:PORTA` e `http://localhost:PORTA/**`
4. Salve.

Sem isso, o Supabase pode bloquear redirects após login/OAuth e a “conexão” parece não funcionar.

## Supabase – RLS ao criar organização (403 / "violates row-level security")

Se ao clicar em **"Criar clínica"** aparecer **403 (Forbidden)** ou:

`new row violates row-level security policy for table "organizations"`

faça o seguinte (uma vez só):

1. No **Supabase Dashboard** do projeto: **SQL Editor** → **New query**.
2. Abra o arquivo **`supabase-rls-fix-403.sql`** na pasta do projeto.
3. Copie **todo** o conteúdo, cole no editor SQL e clique em **Run**.
4. Esse script:
   - Cria a coluna **`owner_id`** em `organizations` se não existir
   - Ativa RLS nas tabelas
   - Remove políticas antigas de INSERT que possam conflitar
   - Cria as políticas que permitem: criar organização (`owner_id = auth.uid()`), ler organizações, criar/vincular em `organization_users`

Depois de rodar com sucesso, faça **logout**, **login** de novo e tente **"Criar clínica"** outra vez.

## Transações em tempo real (webhook)

Para receber transações de cartão/conta vinculada em tempo real:

1. Execute no Supabase o script **`supabase-contas-vinculadas.sql`** (cria a tabela `contas_vinculadas`).
2. No Financeiro, use **"Vincular cartão ou conta"** e crie um vínculo; anote o **account_id** e a **URL do webhook** exibidos.
3. No servidor que expõe a API (ex.: Vercel/Netlify), configure a variável **`WEBHOOK_TRANSACTIONS_SECRET`** com um segredo. O conector/agregador deve enviar esse valor no header **`X-Webhook-Secret`** (ou `X-Webhook-Transactions-Secret`) em cada POST.
4. O conector deve enviar **POST** para `/api/webhook-transacoes` com body JSON: `{ "account_id": "<uuid da conta vinculada>", "transactions": [{ "date": "YYYY-MM-DD", "amount": number, "description": "texto", "type": "debit"|"credit" }] }`.

Sem `WEBHOOK_TRANSACTIONS_SECRET` configurado, o webhook rejeita requisições (em produção convém sempre usar).

## Service worker (sw.js)

- **v3**: não cacheia Supabase; HTML/JS usam **rede primeiro** (cache só quando estiver offline).
- Se ainda aparecer comportamento antigo: em DevTools → **Application** → **Service Workers** → **Unregister** e recarregue a página.
