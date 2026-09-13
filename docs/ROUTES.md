# Fluxo de rotas – SkinClinic

## Resumo

| Destino           | Página          | Quando usar                         |
|-------------------|-----------------|-------------------------------------|
| Login             | `index.html`    | Sem sessão; entrada principal       |
| Onboarding        | `onboarding.html` | Login sem organização (criar clínica) |
| Accept invite     | `index.html#accept-invite` | Convite pendente            |
| Dashboard (app)   | `dashboard.html` | Com sessão e organização            |

## Fluxo pós-login (bootstrap)

1. **Login** em `index.html` → `bootstrapAfterLogin()`:
   - Tem org → redireciona para **`/dashboard.html`**
   - Tem convite → redireciona para **`/index.html#accept-invite`**
   - Sem org e sem convite → redireciona para **`/onboarding.html`**

2. **Onboarding** (`onboarding.html`):
   - Sem sessão → redireciona para **`/index.html`**
   - Já tem org → redireciona para **`/dashboard.html`**
   - Caso contrário → mostra formulário “Nome da clínica”
   - Após criar org → redireciona para **`/dashboard.html`**

3. **Dashboard** (`dashboard.html`):
   - Sem sessão → `protectPage()` redireciona para **`/index.html`**
   - Com sessão → SPA com hash (dashboard, agenda, clientes, etc.)

## Páginas

- **index.html**: login, cadastro, aceitar convite, selecionar org (SPA por hash).
- **onboarding.html**: página única para criar a primeira clínica (sem SPA).
- **dashboard.html**: app principal (SPA com menu).

## Service worker

- Cache: `skinclinic-v2`
- **Onboarding**: sempre busca na rede (`/onboarding.html`, `/onboarding`) para evitar tela em branco por cache antigo.
