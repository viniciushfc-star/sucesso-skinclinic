# Guia passo a passo — do zero até o app no ar

Siga na ordem. Se travar em algum passo, pare e me diga em qual número está.

---

## PARTE 1 — GitHub (guardar seu código na nuvem)

### Passo 1 — Criar o repositório no GitHub

1. Abra o navegador e vá em **https://github.com**
2. Faça login (ou crie uma conta se ainda não tiver).
3. Clique no **+** no canto superior direito → **New repository**.
4. Preencha:
   - **Repository name:** `sucesso-skinclinic`
   - **Description:** (opcional) `App gestão para clínicas`
   - **Public** marcado
   - **NÃO** marque "Add a README"
   - **NÃO** escolha .gitignore
   - **NÃO** escolha license
5. Clique em **Create repository**.
6. Deixe essa página aberta; você vai precisar da URL do repositório (algo como `https://github.com/SEU_USUARIO/sucesso-skinclinic`).

---

### Passo 2 — Instalar o Git no seu PC (só uma vez)

1. Abra **https://git-scm.com**
2. Clique em **Download for Windows** e instale (próximo, próximo, concluir).
3. Feche e abra de novo o **PowerShell** ou o **Prompt de Comando** (para reconhecer o Git).

---

### Passo 3 — Enviar seu projeto para o GitHub

1. Abra o **PowerShell** (botão Windows → digite PowerShell → abrir).
2. Cole e execute **um comando por vez** (troque SEU_USUARIO pelo seu usuário do GitHub):

```powershell
cd c:\Users\ti\Desktop\sucesso
```

```powershell
git init
```

```powershell
git add .
```

```powershell
git commit -m "Envio inicial"
```

```powershell
git branch -M main
```

```powershell
git remote add origin https://github.com/SEU_USUARIO/sucesso-skinclinic.git
```

(Substitua **SEU_USUARIO** pelo seu usuário do GitHub. Exemplo: se sua conta é `joao123`, fica `https://github.com/joao123/sucesso-skinclinic.git`)

```powershell
git push -u origin main
```

3. Se pedir **usuário e senha:**
   - Usuário: seu usuário do GitHub.
   - Senha: **não** use a senha da conta. O GitHub exige um **Personal Access Token**:
     - No GitHub: clique na sua foto (canto superior direito) → **Settings** → no menu esquerdo **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**.
     - Dê um nome (ex.: "vercel"), marque **repo** e gere. **Copie o token** (só aparece uma vez).
     - No PowerShell, quando pedir senha, **cole esse token** no lugar da senha.

4. Quando terminar, no site do GitHub (página do repositório) dê **F5**. Você deve ver todos os arquivos do projeto.

---

## PARTE 2 — Vercel (colocar o app no ar)

### Passo 4 — Conta na Vercel

1. Abra **https://vercel.com**
2. Clique em **Sign Up** e escolha **Continue with GitHub**.
3. Autorize a Vercel a acessar seu GitHub. Pronto, você está dentro do dashboard da Vercel.

---

### Passo 5 — Importar o projeto

1. No dashboard da Vercel, clique em **Add New…** → **Project**.
2. Na lista, procure **sucesso-skinclinic** (ou o nome do seu repositório).
3. Clique em **Import** ao lado dele.
4. Na tela de configuração:
   - **Framework Preset:** deixe **Other**.
   - **Root Directory:** deixe em branco.
   - **Build Command:** pode deixar em branco.
   - **Output Directory:** deixe em branco.

---

### Passo 6 — Variáveis de ambiente (importante)

1. Na mesma tela, abra a seção **Environment Variables**.
2. Adicione **uma por uma** (nome e valor):

| Name                 | Value (você cola o que tem no .env) |
|----------------------|--------------------------------------|
| SUPABASE_URL         | a URL do seu projeto Supabase       |
| SUPABASE_ANON_KEY    | a chave anon do Supabase             |
| SUPABASE_SERVICE_KEY | a chave service_role do Supabase     |
| OPENAI_KEY           | sua chave da OpenAI (se tiver)       |

Para achar no Supabase: **Project Settings** (ícone de engrenagem) → **API** → ali estão URL, anon key e service_role key.

3. Deixe o ambiente em **Production** (ou marque todos).
4. Clique em **Deploy**.

---

### Passo 7 — Esperar o deploy

1. A Vercel vai construir e subir o projeto (1–3 minutos).
2. Quando aparecer **Congratulations!**, clique no link do projeto (ex.: **sucesso-skinclinic.vercel.app**).
3. Sua URL do app será algo como:  
   **https://sucesso-skinclinic.vercel.app**  
   e o dashboard:  
   **https://sucesso-skinclinic.vercel.app/dashboard.html**

---

### Passo 8 — Ajustar o Supabase para a nova URL

1. No **Supabase**: seu projeto → **Authentication** → **URL Configuration**.
2. Em **Redirect URLs**, adicione (uma por linha):
   - `https://sucesso-skinclinic.vercel.app`
   - `https://sucesso-skinclinic.vercel.app/**`
3. Salve.

Assim o login e o app funcionam quando acessados pela URL da Vercel.

---

## Resumo do que você fez

1. Criou um repositório no GitHub.  
2. Instalou o Git e enviou o projeto da pasta **sucesso** para esse repositório.  
3. Conectou a Vercel ao GitHub e importou o mesmo repositório.  
4. Configurou variáveis de ambiente (Supabase e OpenAI).  
5. Fez o primeiro deploy e obteve a URL do app.  
6. Configurou as URLs no Supabase para a Vercel.

Se em algum passo der erro ou você não souber o que clicar, anote **em qual passo** (ex.: “Passo 3, no git push”) e o **texto do erro**, e me mande que eu te guio a partir daí.
