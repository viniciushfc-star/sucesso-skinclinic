# Sincronização Google Calendar (agenda do freelancer)

A **sincronização com o Google Agenda** permite que os compromissos do profissional em outros calendários (ex.: outra clínica, agenda pessoal) sejam considerados na disponibilidade da sua clínica. O sistema lê os eventos do Google e grava blocos de indisponibilidade em `external_calendar_blocks`; a agenda já usa essa tabela para não mostrar o profissional em horários ocupados (com tempo de deslocamento quando for bloco externo).

---

## O que foi implementado

1. **Tabela** `google_calendar_connections` (Supabase) — guarda `refresh_token` por profissional/org para a API usar.
2. **APIs** (pasta `api/google-calendar/`):
   - **auth** — redireciona para OAuth do Google.
   - **callback** — recebe o code, troca por tokens e grava na tabela.
   - **sync** — lê eventos dos próximos 14 dias do Google e atualiza `external_calendar_blocks`.
   - **status** — retorna quem está conectado (sem expor tokens).
   - **disconnect** — remove a conexão.
3. **UI na Equipe** — por membro: botão **Conectar Google Agenda**, **Sincronizar agora** e **Desconectar Google**, além da data da última sincronização.

---

## Como ativar (produção)

### 1. Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um projeto ou use um existente.
3. Ative a **Google Calendar API**: APIs e serviços → Biblioteca → “Google Calendar API” → Ativar.
4. Em **Credenciais**, crie **ID do cliente OAuth 2.0** (tipo “Aplicativo da Web”).
5. Em **URIs de redirecionamento autorizados**, adicione:
   - Em produção: `https://SEU_DOMINIO/api/google-calendar/callback`
   - Em desenvolvimento (ex.: Vercel): `https://SEU_PROJETO.vercel.app/api/google-calendar/callback`
6. Anote o **ID do cliente** e o **Segredo do cliente**.

### 2. Variáveis de ambiente (API)

Configure no ambiente onde as rotas `/api/google-calendar/*` rodam (ex.: Vercel):

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `GOOGLE_CLIENT_ID` | Sim | ID do cliente OAuth (Google Cloud). |
| `GOOGLE_CLIENT_SECRET` | Sim | Segredo do cliente OAuth. |
| `BASE_URL` | Sim* | URL base do app (ex.: `https://app.seudominio.com`). Usado para montar `redirect_uri`. |
| `SUPABASE_URL` | Sim | URL do projeto Supabase. |
| `SUPABASE_SERVICE_KEY` | Sim | Chave service_role do Supabase (para gravar/ler `google_calendar_connections` e `external_calendar_blocks`). |
| `SUPABASE_ANON_KEY` | Para sync/status/disconnect | Chave anon do Supabase (para validar o JWT do usuário nas rotas protegidas). |

\* Em Vercel, pode usar `VERCEL_URL` (a API usa `https://${VERCEL_URL}` quando `BASE_URL` não está definido).

### 3. SQL no Supabase

Rode **uma vez** o script:

- `supabase-google-calendar-connections.sql`

Isso cria a tabela e as políticas RLS.

---

## Fluxo para o usuário

1. **Equipe** → no card do profissional, clica em **Conectar Google Agenda**.
2. É redirecionado ao Google para autorizar acesso à agenda (somente leitura).
3. Volta para **Equipe** com a mensagem de que a conexão foi feita.
4. Clica em **Sincronizar agora** quando quiser atualizar os blocos (ou você pode agendar um cron que chame `POST /api/google-calendar/sync` com o JWT de um usuário da org).
5. Na **Agenda**, ao criar agendamento, o profissional não aparecerá disponível nos horários que constam no Google (com margem de deslocamento para blocos externos).

---

## Segurança

- O **refresh_token** fica apenas no backend (tabela no Supabase acessada com `SUPABASE_SERVICE_KEY`). O frontend nunca lê esse campo.
- As rotas **sync**, **status** e **disconnect** exigem `Authorization: Bearer <jwt_do_usuario>` e checam se o usuário pertence à org.
