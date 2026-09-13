# Infraestrutura do lembrete automático e integração WhatsApp

Guia prático: **como montar a infra** do lembrete (cron/job) e **onde obter** a integração com WhatsApp.

---

## 0. Solução econômica e personalizada (já no app)

Para **diminuir custo** e manter tudo **personalizado**, o sistema já oferece:

| Canal | Como funciona | Custo |
|-------|----------------|-------|
| **E-mail** | Botão **✉️ E-mail** na agenda: abre o programa de e-mail do computador com destinatário, assunto e texto já preenchidos (nome do cliente, data, hora, link de confirmação, nome da clínica). Você só clica em “Enviar”. | **Zero** — usa seu e-mail atual (Gmail, Outlook, etc.). |
| **Lembrete** | Botão **📋 Lembrete**: copia a mensagem (com link de confirmação) e abre o WhatsApp se o cliente tiver telefone. | **Zero** — não usa API de WhatsApp; só abre o app. |
| **📲 WhatsApp** | Igual ao Lembrete, enviando a mensagem direto para o número. | **Zero** (envio manual pelo seu WhatsApp). |

- **Personalizado:** o texto sempre traz o nome do cliente, data, hora, nome da clínica e link único de confirmação.
- **Recomendação:** use **E-mail** quando o cliente tiver e-mail cadastrado (custo zero e profissional). Use **WhatsApp** quando preferir; o link de confirmação funciona nos dois.

Quando quiser **envio automático** (sem clicar por agendamento), aí sim entra a infra e a integração das seções abaixo.

---

## 1. Infraestrutura do lembrete automático

O objetivo: **a cada X horas** (ex.: uma vez por dia), um job busca os agendamentos das próximas 24h (ou 48h) e **envia** lembrete (WhatsApp ou e-mail) para o cliente.

### Opção A: Supabase (pg_cron + Edge Function) — recomendado se você já usa Supabase

1. **Habilitar extensões no Supabase**
   - No Dashboard: **Database** → **Extensions** → ativar **pg_cron** e **pg_net** (se disponíveis no seu plano).
   - Ou via SQL: `CREATE EXTENSION IF NOT EXISTS pg_cron;` e `pg_net` (consulte a doc do Supabase para sua versão).

2. **Criar uma Edge Function** que:
   - Recebe uma chamada HTTP (será acionada pelo cron).
   - Usa a **service role key** do Supabase para ler a tabela `agenda` (e `clients` para telefone).
   - Filtra: `data` = amanhã (ou hoje) e `reminder_sent_at` é null.
   - Para cada agendamento: chama a API de envio (WhatsApp ou e-mail) e atualiza `reminder_sent_at`.

3. **Agendar a função com pg_cron**
   - Exemplo: todo dia às 18h, chamar a Edge Function via `net.http_post` (URL da função + header `Authorization: Bearer SERVICE_ROLE_KEY`).
   - Documentação: [Supabase – Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) e [Cron](https://supabase.com/docs/guides/cron).

**Vantagem:** tudo dentro do mesmo projeto (Supabase). **Desvantagem:** plano gratuito pode ter limite de Edge Functions e de cron.

### Opção B: Serviço de cron externo

- Use um serviço que chame uma **URL sua** em horários fixos (ex.: [cron-job.org](https://cron-job.org), [EasyCron](https://www.easycron.com), ou um pequeno servidor em VPS/Cloud Run).
- Essa URL é um **endpoint** do seu backend (Node, PHP, etc.) ou uma **Edge Function** do Supabase exposta como HTTP.
- O endpoint faz a mesma lógica: buscar agendamentos, enviar lembrete, atualizar `reminder_sent_at`.

### Opção C: Vercel Cron (já no projeto)

No `vercel.json` o job chama `GET /api/lembretes-auto` todo dia (`0 11 * * *` = por volta das 8h em Brasília, limite do plano Hobby: 1 vez/dia).

Na Vercel → Project → Settings → Environment Variables:

- `CRON_SECRET` (nome obrigatório; a Vercel manda `Authorization: Bearer …`)
- `SUPABASE_URL` e `SUPABASE_SERVICE_KEY`
- `WHATSAPP_TOKEN` e `WHATSAPP_PHONE_ID` (Meta Cloud API)
- opcional: `RESEND_API_KEY`, `BASE_URL=https://skinclinic-one.vercel.app`

Depois do deploy, em **Empresa** use “Atualizar status” e “Enviar lembretes desta clínica agora”.

---

## 2. Onde tirar a integração com WhatsApp

Há duas formas principais: **API oficial (Meta)** ou **provedor (BSP)** que já conecta na API por você.

### Caminho 1: API oficial do WhatsApp (Meta)

- **Site:** [WhatsApp Business Platform](https://business.whatsapp.com/products/business-platform) / [Developer Hub](https://developers.facebook.com/docs/whatsapp).
- **O que é:** você (ou seu dev) integra direto na **WhatsApp Cloud API** da Meta.
- **Requisitos:** conta Meta/Facebook, criar app em [developers.facebook.com](https://developers.facebook.com), configurar **WhatsApp Business Account (WABA)** e **número de telefone comercial** (verificado).
- **Custo:** tarifa da Meta por tipo de mensagem (utilitário, marketing, autenticação). Há [período de teste gratuito](https://developers.facebook.com/docs/whatsapp/embedded-signup) e sandbox.
- **Documentação:** [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) (envio de mensagens, templates, etc.).

**Bom para:** quem quer controle total e não quer depender de um intermediário. Exige desenvolvimento (backend/Edge Function que chame a API da Meta).

### Caminho 2: Provedor (BSP – Business Solution Provider)

Você contrata um serviço que **já fala com a API do WhatsApp** e oferece API própria (mais simples) ou painel. Exemplos:

| Provedor | O que oferece | Site / observação |
|----------|----------------|-------------------|
| **Twilio** | API de envio de WhatsApp (e SMS); SDK em várias linguagens | [twilio.com/whatsapp](https://www.twilio.com/whatsapp) — cobra por mensagem (ex.: ~US$ 0,005 + tarifa Meta). |
| **MessageBird** | API de mensagens (WhatsApp, SMS) | [messagebird.com](https://messagebird.com) |
| **Take Blip** | Foco em conversação e chatbots; muito usado no Brasil | [blip.ai](https://blip.ai) |
| **Z-API** | WhatsApp API para Brasil, painel e API | [z-api.io](https://z-api.io) — verifique termos e conformidade com as políticas do WhatsApp. |
| **Evolution API** | Solução open source que usa WhatsApp Web; hospedagem própria | [evolution-api.com](https://evolution-api.com) — não é a API oficial; risco de bloqueio. |

- **Custo:** geralmente pago por mensagem ou plano. Twilio: [preços WhatsApp](https://www.twilio.com/pt-br/whatsapp/pricing) (tarifa Twilio + tarifa Meta).
- **Vantagem:** menos código de integração; o provedor cuida de parte da infra e do canal.
- **Atenção:** use sempre soluções em conformidade com as [políticas do WhatsApp](https://www.whatsapp.com/legal/business-policy); soluções não oficiais podem resultar em bloqueio do número.

### Resumo prático

- **“Onde tiro a integração?”**  
  - **Direto:** [Meta – WhatsApp for Developers](https://developers.facebook.com/docs/whatsapp) (Cloud API).  
  - **Por provedor:** Twilio, Take Blip, MessageBird, Z-API (escolha um que seja BSP oficial ou aceito pela Meta para não violar políticas).

- **No seu sistema:** hoje o app só **abre o WhatsApp** com a mensagem pronta (link `wa.me`). Para **envio automático**, você precisa:
  1. Conta/número e acesso à API (Meta ou BSP).
  2. Um backend ou Edge Function que chame essa API com o texto e o número do cliente.
  3. O job (cron) que rode no horário desejado e chame esse backend/Edge Function (como na seção 1).

---

## 3. Ordem sugerida para implementar

1. **Escolher canal:** WhatsApp (API/BSP) ou e-mail (mais simples: SMTP ou SendGrid, etc.).
2. **Criar conta e obter credenciais:** token/API key do WhatsApp (Meta ou BSP) ou SMTP para e-mail.
3. **Implementar serviço de envio:** uma função (no backend ou Edge Function) que recebe (telefone ou e-mail, texto, link de confirmação) e envia a mensagem.
4. **Criar job (cron):** Supabase pg_cron ou cron externo chamando essa função no horário desejado (ex.: 18h para lembretes do dia seguinte).
5. **Lógica do lembrete:** buscar na `agenda` os agendamentos no intervalo desejado, com `reminder_sent_at` null; para cada um, montar mensagem, chamar o serviço de envio e atualizar `reminder_sent_at`.

Se quiser, no próximo passo podemos desenhar a **assinatura exata** da Edge Function (entrada/saída) e o **SQL do pg_cron** para o seu projeto Supabase.