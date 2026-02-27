# Colocar o SkinClinic na internet (igual na sua máquina)

Para o app funcionar na internet **como na sua máquina**, siga estes passos.

---

## Deploy na Vercel (recomendado)

O projeto já está preparado para a Vercel: `vercel.json` e `api/index.js` encaminham tudo para o Express (páginas + API).

### Passo a passo

1. **Conecte o repositório**  
   No [dashboard da Vercel](https://vercel.com/dashboard), **Add New → Project** e importe o repositório do SkinClinic. A Vercel usa o `vercel.json` e o `api/index.js` automaticamente.

2. **Variáveis de ambiente**  
   Em **Settings → Environment Variables** do projeto, adicione:

   | Variável | Obrigatório | Exemplo |
   |----------|-------------|---------|
   | `SUPABASE_URL` | Sim | `https://xxx.supabase.co` |
   | `SUPABASE_ANON_KEY` | Sim | `eyJ...` |
   | `SUPABASE_SERVICE_KEY` | Se usar portal/convites | `eyJ...` (service_role) |
   | `BASE_URL` | Sim | `https://seu-projeto.vercel.app` (ou seu domínio customizado) |
   | `OPENAI_KEY` | Para Copilot/Preço/Marketing etc. | `sk-...` |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Para Google Calendar | (opcional) |
   | `RESEND_API_KEY` | Para e-mail de convite (Equipe) | (opcional) |

   **Importante:** defina `BASE_URL` com a URL que o usuário usa para acessar o app (ex.: `https://seu-projeto.vercel.app`). Se usar domínio customizado, use esse domínio.

3. **Supabase – Redirect URLs**  
   No [Supabase](https://supabase.com/dashboard) → seu projeto → **Authentication → URL Configuration → Redirect URLs**, adicione:

   - `https://seu-projeto.vercel.app/auth-callback.html`
   - `https://seu-projeto.vercel.app/new-password.html`
   - `https://seu-projeto.vercel.app/`  
   (e o mesmo com seu domínio customizado, se tiver)

4. **Deploy**  
   Dê **Deploy** (ou faça push no Git). Após o deploy, acesse `https://seu-projeto.vercel.app` (ou a URL que a Vercel mostrar). O login e a API devem funcionar como na sua máquina.

5. **Domínio customizado (opcional)**  
   Em **Settings → Domains** na Vercel, adicione seu domínio. Depois atualize `BASE_URL` e as Redirect URLs no Supabase para usar esse domínio.

### Erros no site em produção (auth.js, favicon, ícone PWA)

Se você vê no site publicado (ex.: **skinclinic-one.vercel.app**):

- **`auth.js:187 Uncaught SyntaxError: Unexpected identifier 'supabase'`**
- **404 em favicon.ico ou icons/icon-192.png**

é porque a **Vercel está servindo uma versão antiga** do código. As correções já estão no seu repositório local; é preciso enviá-las e deixar a Vercel fazer um novo deploy.

**O que fazer:**

1. No terminal, na pasta do projeto:
   ```bash
   git status
   git add -A
   git commit -m "fix: auth.js sintaxe, manifest sem ícone, favicon"
   git push origin main
   ```
   (Use o nome do branch que a Vercel usa, se for outro, ex.: `master`.)

2. No [dashboard da Vercel](https://vercel.com/dashboard), abra o projeto e confira se um **novo deploy** foi disparado pelo push. Se não aparecer, use **Deployments → Redeploy** (ou "Clear cache and redeploy").

3. Depois do deploy concluído, teste em **aba anônima** ou com cache desativado, para não carregar JS antigo.

---

## 1. Rodar o servidor Node (fora da Vercel)

O app não é só arquivos estáticos: ele usa um **servidor Node** que serve as páginas e as rotas da API (`/api/...`).

- Na sua máquina você provavelmente usa: `npm start` ou `node server.js`.
- **Na internet** você precisa de um provedor que execute Node (VPS, Railway, Render, Fly.io, ou Vercel/Netlify com funções serverless para a API).

**Comando típico:**

```bash
npm install
npm start
```

O servidor sobe na porta 3000 (ou na variável `PORT`). Acesse: `http://SEU-SERVIDOR:3000` (ou o domínio que apontar para essa porta).

---

## 2. Variáveis de ambiente

Copie o `.env.example` para `.env` e preencha no **servidor** (não só na sua máquina):

- `SUPABASE_URL` e `SUPABASE_ANON_KEY` (e `SUPABASE_SERVICE_KEY` se usar portal do cliente, convites, etc.)
- `BASE_URL`: URL pública do app, **exatamente como o usuário acessa**. Ex.: `https://meudominio.com` ou `https://meudominio.com/skinclinic`
- Para Google Calendar: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e o mesmo `BASE_URL` nos redirects do Google Cloud.

Se o app estiver em **subpasta** (ex.: `https://meusite.com/sucesso/`), o próprio front detecta o base path e os links/redirects já funcionam.

---

## 3. App em subpasta

Se você publicar em uma **subpasta** (ex.: `https://seusite.com/sucesso/dashboard.html`):

- O código já usa **base path**: os redirects e o service worker consideram a subpasta.
- Acesse sempre pela URL completa: `https://seusite.com/sucesso/` ou `https://seusite.com/sucesso/dashboard.html`.
- No Supabase (Authentication → URL Configuration), adicione em **Redirect URLs** a URL de callback com a subpasta, ex.: `https://seusite.com/sucesso/auth-callback.html`.

---

## 4. Só arquivos estáticos (sem Node)

Se você colocar **só os arquivos** (HTML, JS, CSS) em um hospedagem estática (ex.: GitHub Pages, Netlify estático):

- O **login, dashboard e navegação** podem funcionar (Supabase roda no navegador).
- As rotas **/api/...** (Copilot, Preço, Marketing, OCR, Google Calendar, etc.) **não vão funcionar** porque não há servidor Node.
- Para tudo igual à sua máquina, é necessário rodar o `server.js` em algum lugar (ver passo 1).

---

## 5. Resumo

| O que você quer | O que fazer |
|-----------------|-------------|
| **Deploy na Vercel** | Conectar o repo na Vercel, configurar env vars (`SUPABASE_*`, `BASE_URL`, etc.) e Redirect URLs no Supabase. Ver seção "Deploy na Vercel" acima. |
| Igual na sua máquina (API + tudo) em outro host | Subir o servidor Node (VPS, Railway, Render, etc.) e configurar `BASE_URL` e Supabase. |
| App em subpasta (ex.: /sucesso/) | Colocar os arquivos na subpasta; o base path é detectado; configurar redirect URLs do Supabase com a subpasta. |
| Só testar front (sem API) | Servir a pasta estática; login/dashboard podem funcionar; recursos que usam /api/ vão falhar. |

Se mesmo assim não ficar igual à sua máquina, confira: **URL que você está abrindo** (com ou sem subpasta), **se o Node está rodando** no host e **se o .env no servidor** está com `BASE_URL` e Supabase corretos.
