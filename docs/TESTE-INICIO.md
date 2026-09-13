# Iniciar fase de teste

Checklist para rodar o projeto (local ou na nuvem) e começar a testar.

---

## 1. Teste local (rápido)

### Passo a passo

1. **Node.js**  
   - Tenha Node 18+ instalado (`node -v`).

2. **Variáveis de ambiente**  
   - Copie `.env.example` para `.env`.  
   - Preencha no mínimo:
     - `SUPABASE_URL` — URL do projeto no [Supabase](https://supabase.com/dashboard).
     - `SUPABASE_SERVICE_KEY` — chave **service_role** (Settings → API).
     - `SUPABASE_ANON_KEY` — chave **anon/public**.
     - `OPENAI_KEY` — para Copilot, Preço, Marketing, etc. (opcional para testar só agenda/financeiro).
   - Para teste local, deixe `BASE_URL=http://localhost:3000` e `PORT=3000` (ou omita).

3. **Supabase – Redirect URLs (login)**  
   - No Supabase: **Authentication** → **URL Configuration** → **Redirect URLs**.  
   - Adicione: `http://localhost:3000` e `http://localhost:3000/**`.  
   - Salve.

4. **Migrações no Supabase**  
   - No **SQL Editor** do Supabase, rode (se ainda não rodou) os scripts da pasta do projeto, por exemplo:
     - `supabase-rls-fix-403.sql` (criar organização sem 403).
     - `supabase-financeiro-forma-pagamento-valor-recebido.sql` (forma de pagamento e valor recebido no financeiro).
   - Consulte `supabase-ordem-scripts.md` para a ordem sugerida.

5. **Instalar e subir o servidor**  
   ```bash
   npm install
   npm start
   ```  
   - Deve aparecer: `Servidor rodando em http://localhost:3000`.

6. **Abrir no navegador**  
   - **App:** [http://localhost:3000](http://localhost:3000) ou [http://localhost:3000/dashboard.html](http://localhost:3000/dashboard.html).  
   - **API:** [http://localhost:3000/api/health](http://localhost:3000/api/health) → deve retornar `{"ok":true}`.

7. **Testar**  
   - Login (Supabase Auth).  
   - Criar organização / selecionar org.  
   - Agenda, Financeiro, Dar baixa (forma de pagamento + valor do procedimento + acréscimo).  
   - Copilot/Preço (se `OPENAI_KEY` estiver no `.env`).

---

## 2. Postar na nuvem para teste (ex.: Render)

Para deixar o app acessível por URL (teste com outras pessoas ou em outro dispositivo).

### Opção A – Render.com (Web Service)

1. Crie uma conta em [render.com](https://render.com).

2. **Novo Web Service**  
   - Conecte o repositório Git do projeto (GitHub/GitLab).  
   - **Runtime:** Node.  
   - **Build command:** `npm install`  
   - **Start command:** `npm start`  
   - **Variáveis de ambiente:** adicione as mesmas do `.env` (SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY, OPENAI_KEY, BASE_URL com a URL do Render, etc.).  
   - **PORT:** o Render define automaticamente; não precisa definir se o código usa `process.env.PORT`.

3. **Supabase – Redirect URLs**  
   - Adicione a URL do serviço, por exemplo:  
     `https://seu-app.onrender.com` e `https://seu-app.onrender.com/**`.

4. Depois do deploy, acesse `https://seu-app.onrender.com` para testar.

### Opção B – Usar `render.yaml` (deploy por repositório)

Na raiz do projeto existe um `render.yaml`. No Render:

- **Dashboard** → **New** → **Blueprint** → selecione o repositório.  
- O Render usa o `render.yaml` para criar o Web Service com o comando de start correto.  
- Configure as **Environment Variables** no painel do serviço (mesmas do `.env`).

---

## 3. Checklist antes de considerar “teste pronto”

- [ ] `npm start` sobe sem erro.  
- [ ] `/api/health` retorna `{"ok":true}`.  
- [ ] Login e criação/seleção de organização funcionam.  
- [ ] Supabase com redirect URLs corretos (localhost e/ou URL de produção).  
- [ ] Migrações principais rodadas no Supabase (RLS, financeiro com forma_pagamento/valor_recebido se for usar dar baixa).  
- [ ] Dar baixa pela agenda (valor do procedimento + acréscimo + forma de pagamento) testado.  
- [ ] Se for usar IA: `OPENAI_KEY` no `.env` (ou nas variáveis do Render).

---

## 4. Problemas comuns

| Problema | O que verificar |
|----------|------------------|
| 404 no “Gerar link” (portal) | Servidor rodando com `npm start`; acessar o app pela mesma origem (ex.: localhost:3000); `.env` com SUPABASE_* e rota `/api/create-portal-session` carregada. |
| 403 ao criar organização | Rodar `supabase-rls-fix-403.sql` no Supabase. |
| Login não redireciona | Redirect URLs no Supabase (localhost ou URL do Render). |
| Copilot/Preço não respondem | `OPENAI_KEY` no `.env` (ou nas env do Render). |

Mais detalhes em **CONFIG.md**.
