# Como colocar no ar e proteger o código

Guia objetivo: **conectar as APIs**, **colocar o app no ar** para pessoas testarem e **proteger** o que for possível.

---

## Parte 1: Conectar as APIs e colocar no ar

### O que você tem hoje

- **Frontend:** HTML + JS + CSS (pasta do projeto). O navegador chama `/api/...` (preco, marketing, copiloto, etc.) e usa o **Supabase** direto do navegador (auth, dados).
- **APIs:** Pasta `api/` com funções que usam **OpenAI** e **Supabase** (service role). Precisam rodar em um **servidor Node** (não são estáticos).
- **Supabase:** Já é na nuvem. Você só precisa da **URL** e da **chave anon (public)** no frontend; as APIs usam **URL + service role** no servidor.

### Passo a passo resumido

#### 1) Supabase (já está na nuvem)

- Crie um projeto em [supabase.com](https://supabase.com) (ou use o que já tem).
- Rode todos os scripts SQL necessários (organizations, RLS, procedures, etc.) no **SQL Editor** do dashboard.
- Em **Authentication** → **URL Configuration**, adicione as URLs onde o app vai rodar:
  - Desenvolvimento: `http://localhost:3000`, `http://localhost:3000/**`
  - Produção: `https://seu-dominio.com`, `https://seu-dominio.com/**`
- Anote:
  - **Project URL** (ex.: `https://xxxx.supabase.co`)
  - **anon public** (para o frontend)
  - **service_role** (só para as APIs no servidor; nunca no frontend)

#### 2) Frontend no ar (HTML/JS/CSS)

Opções comuns:

| Opção | Como | Observação |
|-------|------|------------|
| **Vercel** | Conecte o repositório; build: sem build ou `npm run build` se tiver; output: pasta raiz ou `dist`. | Grátis para projetos pequenos. |
| **Netlify** | Idem: conecte o repo, aponte para a pasta do projeto, public folder = raiz. | Grátis. |
| **Render** | Static Site: repo, pasta raiz. | Grátis. |
| **GitHub Pages** | Branch `gh-pages` ou Actions que fazem deploy da pasta. | Grátis; só arquivos estáticos. |

No frontend você precisa que a **URL e a chave anon do Supabase** estejam corretas. Hoje isso está em `js/core/supabase.js`. Para produção:

- **Opção A:** Trocar manualmente em `supabase.js` pela URL e chave do projeto de produção (e **não** commitar a chave service_role).
- **Opção B:** Usar variáveis de ambiente no build (ex.: Vercel/Netlify injetam `SUPABASE_URL` e `SUPABASE_ANON_KEY`) e um passo de build que gera um `supabase.js` ou um `config.js` com esses valores. Assim as chaves não ficam no repositório.

**Importante:** No Supabase, a chave **anon** é pensada para ser usada no navegador; a segurança vem das **políticas RLS**. Mesmo assim, não exponha a chave **service_role** em lugar nenhum do frontend.

#### 3) APIs no ar (Node)

As rotas em `api/` (preco, marketing, copiloto, etc.) precisam de um servidor Node que:

- Receba requisições HTTP (ex.: POST `/api/preco`, `/api/marketing`).
- Use variáveis de ambiente: `OPENAI_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (service role), e `WEBHOOK_TRANSACTIONS_SECRET` se usar webhook.

Opções:

| Opção | Como | Observação |
|-------|------|------------|
| **Vercel (Serverless)** | Coloque cada arquivo em `api/preco.js`, `api/marketing.js` etc. e exporte um handler padrão (ex.: `export default function handler(req, res)`). Configure no projeto as env vars. | Cada arquivo vira uma função serverless. |
| **Netlify Functions** | Coloque as funções em `netlify/functions/` e mapeie para `/api/...` no `netlify.toml`. | Similar ao Vercel. |
| **Render / Railway / VPS** | Crie um servidor Node (Express/Fastify) que importa as rotas em `api/` e expõe como POST/GET em `/api/preco`, etc. Rode esse servidor e configure as env vars no painel. | Controle total. |

Exemplo mínimo com Express (se subir um servidor próprio):

```js
// server.js (exemplo)
const express = require('express');
const path = require('path');
const app = express();
app.use(express.json());

// Servir frontend estático
app.use(express.static(path.join(__dirname, '.')));

// Rotas da API (adaptar conforme seus arquivos em api/)
app.post('/api/preco', require('./api/preco').default || require('./api/preco'));
// ... outras rotas

app.listen(process.env.PORT || 3000);
```

Configure no ambiente (Vercel, Netlify, Render, etc.):

- `OPENAI_KEY` — chave da OpenAI para preco, marketing, copiloto, etc.
- `SUPABASE_URL` — URL do projeto Supabase.
- `SUPABASE_SERVICE_KEY` — chave **service_role** do Supabase (só no servidor).
- `WEBHOOK_TRANSACTIONS_SECRET` — se usar webhook de transações.

#### 4) CORS

Se o frontend estiver em um domínio (ex.: `https://app.seudominio.com`) e as APIs em outro (ex.: `https://api.seudominio.com`), o navegador exige CORS. No servidor das APIs, permita a origem do frontend:

```js
// Exemplo em Node
res.setHeader('Access-Control-Allow-Origin', 'https://app.seudominio.com');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
```

Se frontend e API estiverem no **mesmo domínio** (ex.: Vercel servindo estático e `/api/*` no mesmo projeto), muitas vezes não precisa configurar CORS manualmente.

#### 5) Testadores

- Envie o link do app (ex.: `https://seu-app.vercel.app` ou `https://app.seudominio.com`).
- Crie usuários no Supabase (Authentication → Users) ou deixe que se cadastrem pelo próprio app.
- Configure as **Redirect URLs** no Supabase para essa URL de produção.

---

## Parte 2: Proteger o código (o que é possível)

### O que pode e o que não pode ser “protegido”

| O quê | Pode proteger? | Como |
|-------|----------------|------|
| **Código que roda no servidor (APIs)** | Sim | Ele nunca é enviado ao navegador. Mantenha as APIs em um servidor seu e não exponha o repositório. |
| **Chaves e segredos** | Sim | Use **só variáveis de ambiente** no servidor (OPENAI_KEY, SUPABASE_SERVICE_KEY, etc.). Nunca coloque no frontend nem no repositório. |
| **Código que roda no navegador (HTML/JS/CSS)** | Não totalmente | O navegador precisa baixar o JS; qualquer pessoa pode ver/copiar. Você só pode **dificultar** (minificar, ofuscar) e **reduzir valor** do que está no frontend. |

Ou seja: **proteger o código** de forma séria é manter **lógica sensível e segredos no servidor** e **autenticação/autorização** (login, RLS no Supabase). O frontend sempre poderá ser inspecionado.

### O que fazer na prática

1. **Segredos só no servidor**  
   - Supabase **service_role** e **OPENAI_KEY** só nas variáveis de ambiente do servidor que roda as APIs.  
   - No frontend: só a URL do Supabase e a chave **anon** (que o Supabase já considera pública, com RLS protegendo os dados).

2. **Autenticação e RLS**  
   - Login via Supabase Auth; só usuários logados acessam o app.  
   - RLS nas tabelas do Supabase para que cada organização veja só os próprios dados. Assim, mesmo que alguém copie o frontend, não acessa dados de outros sem conta.

3. **Dificultar cópia do frontend (opcional)**  
   - **Minificar** o JS (ex.: esbuild, terser) para um único arquivo menor e ilegível.  
   - **Ofuscar** (ex.: javascript-obfuscator) para tornar mais difícil entender e reutilizar.  
   - Isso **não impede** a cópia; só desencoraja uso casual e leitura fácil.

4. **Não commitar chaves**  
   - Use `.env` (e coloque `.env` no `.gitignore`) em desenvolvimento.  
   - Em produção, use apenas variáveis de ambiente do provedor (Vercel, Netlify, Render, etc.).

5. **Termos de uso**  
   - Coloque no app um link para “Termos de uso” e “Política de privacidade” e deixe claro que o software é de uso licenciado e não pode ser copiado/revendido. Isso é proteção jurídica, não técnica.

### Resumo

- **Colocar no ar:** frontend em Vercel/Netlify/Render; APIs no mesmo lugar (Vercel/Netlify functions) ou em um servidor Node; Supabase já na nuvem; configurar URLs e env vars.
- **Proteger:** APIs e chaves no servidor; auth + RLS; opcionalmente minificar/ofuscar o JS; não commitar segredos; termos de uso.

Assim você conecta as APIs, coloca o app no ar para testadores e protege o que realmente pode ser protegido (servidor e segredos), sabendo que o código do frontend sempre poderá ser visto por quem acessa o site.
