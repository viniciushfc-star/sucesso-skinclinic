# Deploy na Vercel — passo a passo

Este guia explica como subir o projeto na Vercel para testes ou produção.

---

## 1. Conta e CLI (se quiser usar o terminal)

1. Crie uma conta em **[vercel.com](https://vercel.com)** (pode usar GitHub).
2. **Opcional:** instale a CLI para deploy pelo terminal:
   ```bash
   npm i -g vercel
   ```
   Se preferir, pode fazer tudo pelo site (passo 4) sem instalar nada.

---

## 2. Deixar o código pronto

1. Confirme que estes arquivos existem na raiz do projeto:
   - `vercel.json` — rewrites e configuração da função
   - `api/index.js` — handler que encaminha tudo para o Express
   - `server.js` — exporta `app` e `registerRoutes` e só inicia o servidor quando **não** está na Vercel

2. Teste localmente (sem variável `VERCEL`):
   ```bash
   npm install
   npm start
   ```
   Abra `http://localhost:3000` e `http://localhost:3000/dashboard.html`. Tudo deve funcionar como antes.

---

## 3. Subir o código para o GitHub (recomendado)

1. Crie um repositório no GitHub (ex.: `meu-skinclinic`).
2. Na pasta do projeto:
   ```bash
   git init
   git add .
   git commit -m "Preparar deploy Vercel"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/meu-skinclinic.git
   git push -u origin main
   ```
   Assim a Vercel consegue fazer deploy automático a cada push.

Se não quiser usar Git, você pode fazer deploy direto pela CLI (passo 5).

---

## 4. Conectar o projeto na Vercel (pelo site)

1. Acesse **[vercel.com/new](https://vercel.com/new)**.
2. **Import Git Repository:**  
   Clique em “Import” no repositório do GitHub onde está o projeto.  
   Se não aparecer, clique em “Import Third-Party Git Repository” e cole a URL do repo.
3. **Configure o projeto:**
   - **Framework Preset:** “Other” (não é Next.js/CRA).
   - **Root Directory:** deixe em branco (raiz do repo).
   - **Build Command:** pode deixar em branco ou `npm install` (o `vercel.json` já tem `buildCommand` se quiser).
   - **Output Directory:** deixe em branco.
   - **Install Command:** `npm install`.
4. **Não clique em Deploy ainda.** Abra a seção **“Environment Variables”** e adicione as variáveis do passo 6.
5. Depois de salvar as variáveis, clique em **Deploy**.

---

## 5. Deploy pela CLI (alternativa)

Na pasta do projeto:

```bash
cd c:\Users\ti\Desktop\sucesso
npm install -g vercel
vercel login
vercel
```

Responda às perguntas (nome do projeto, etc.). Depois do primeiro deploy, configure as variáveis de ambiente no dashboard (passo 6) e faça um novo deploy:

```bash
vercel --prod
```

---

## 6. Variáveis de ambiente na Vercel

No dashboard do projeto: **Settings → Environment Variables**. Adicione as mesmas que você usa no `.env` local, por exemplo:

| Nome | Descrição | Obrigatório |
|------|-----------|-------------|
| `SUPABASE_URL` | URL do projeto (ex.: `https://xxx.supabase.co`) | Sim |
| `SUPABASE_ANON_KEY` | Chave anônima (Project Settings → API) | Sim |
| `SUPABASE_SERVICE_KEY` | service_role (API → service_role) | Sim (portal, backend) |
| `OPENAI_KEY` | Chave da OpenAI (Copilot, IA) | Para usar IA |
| `VERCEL` | Não defina manualmente; a Vercel define sozinha | — |

- Para **Production**, **Preview** e **Development** marque conforme quiser (recomendado: pelo menos Production).
- Depois de alterar variáveis, faça um **Redeploy** em **Deployments** → ⋮ no último deploy → **Redeploy**.

---

## 7. URLs após o deploy

- **App (front + API):**  
  `https://SEU-PROJETO.vercel.app`  
  Ex.: `https://SEU-PROJETO.vercel.app/dashboard.html`
- **API saúde:**  
  `https://SEU-PROJETO.vercel.app/api/health`

No Supabase (Authentication → URL Configuration), adicione em **Redirect URLs**:

- `https://SEU-PROJETO.vercel.app`
- `https://SEU-PROJETO.vercel.app/**`
- `https://SEU-PROJETO.vercel.app/dashboard.html`

Assim login e callbacks continuam funcionando.

---

## 8. Resumo rápido

1. Conta na Vercel e (opcional) CLI.
2. Código com `vercel.json` e `api/index.js` na raiz.
3. Repo no GitHub (recomendado).
4. **Import** do repo em vercel.com/new.
5. **Environment Variables** com Supabase e, se usar, OpenAI.
6. **Deploy** e depois **Redeploy** se mudar variáveis.
7. Configurar **Redirect URLs** no Supabase com a URL da Vercel.

Se algo falhar, confira os logs em **Deployments** → último deploy → **Functions** ou **Logs** para ver erros da API ou da função.
