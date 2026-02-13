# 404 em create_client_portal_session — como resolver

Se o app continua retornando **404** ao gerar o link do portal, faça na ordem:

---

## 1. Confirmar o projeto

- A URL do erro é: `https://ipaayevpoqllucltvuhj.supabase.co`
- No [Supabase Dashboard](https://supabase.com/dashboard), abra **esse** projeto (o ID aparece na URL ou no nome do projeto).

---

## 2. Rodar o script atualizado

1. No projeto correto: **SQL Editor** → **New query**.
2. Copie **todo** o conteúdo de **`supabase-criar-create-client-portal-session.sql`** (incluindo os `GRANT EXECUTE`).
3. Clique em **Run**.
4. Veja o resultado da última query: deve aparecer **1 linha** com `routine_schema = public` e `routine_name = create_client_portal_session`. Se não aparecer, a função não foi criada (veja mensagem de erro em vermelho).

---

## 3. Recarregar o schema da API (importante)

O Supabase usa um cache do schema. Depois de criar a função, é preciso recarregar:

1. No menu lateral: **Settings** (ou **Project Settings**).
2. Procure por **API** ou **Schema**.
3. Se existir botão **"Reload schema cache"** ou **"Restart API"**, clique.
4. Ou: **Database** → **Roles** / **Extensions** — às vezes há opção de “Refresh” do schema.

Se não achar essa opção: faça um pequeno **restart do projeto** em **Settings → General → Pause project** e depois **Restore project** (só se puder parar o projeto por 1 minuto).

---

## 4. Conferir se a função existe

No **SQL Editor**, rode:

```sql
SELECT routine_schema, routine_name
  FROM information_schema.routines
  WHERE routine_name = 'create_client_portal_session';
```

- Se retornar **0 linhas**: a função não está criada nesse projeto; rode de novo o script do passo 2 e confira erros.
- Se retornar **1 linha** com `routine_schema = public`: a função existe; o 404 costuma ser cache. Siga o passo 3.

---

## 5. Testar de novo no app

- Recarregue a página do dashboard (F5 ou Ctrl+Shift+R para limpar cache).
- Gere o link do portal de novo.

Se ainda der 404, envie:
1. Resultado da query do passo 4 (a função aparece?).
2. Se no Dashboard existe **Database → Functions** e se **create_client_portal_session** aparece lá.
