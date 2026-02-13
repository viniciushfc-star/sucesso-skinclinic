# Revisão: portal do cliente, WhatsApp e confirmação de horário

## Resumo

Revisados o portal do cliente, o envio de confirmação de horário via WhatsApp e o contato com o cliente (portal + WhatsApp). Ajustes e novas funcionalidades abaixo.

---

## 1. Portal do cliente – bug no dashboard

**Problema:** No dashboard do portal, o botão **"Minha rotina de skincare"** nunca aparecia, mesmo quando a clínica liberava a rotina.

**Causa:** `renderDashboard(protocol, records, !!skincareRotina)` era chamado com três argumentos, mas a função só recebia dois. No HTML usava-se a variável `hasSkincareRotina`, que não existia no escopo (ReferenceError em tempo de execução ou sempre falsy).

**Correção:** Em `js/Client/dashboard.client.js` a função passou a ter o terceiro parâmetro:  
`renderDashboard(protocol, records, hasSkincareRotina = false)` e o template usa esse parâmetro. O botão da rotina de skincare passa a ser exibido quando houver rotina liberada.

---

## 2. Contato com o cliente pelo portal

**Mensagens (Fale com a clínica):** A tela **#mensagens** usa `sendClientMessage(description)`, que chama `report_client_event("Mensagem", description)`. O evento vai para `client_events` (ou RPC equivalente). Nenhuma alteração necessária.

**Relatar evento / Relatar reação ou dúvida:** O dashboard tem "Relatar evento" e "Relatar reação ou dúvida" (este leva para #mensagens). Fluxo consistente com o esperado.

---

## 3. Confirmação de horário via WhatsApp e portal

**Antes:**  
- Na agenda, o botão WhatsApp enviava apenas a mensagem fixa: "Olá! Lembrete do seu atendimento."  
- Não havia link para o cliente confirmar.  
- O serviço `confirmations.service.js` tinha `createConfirmation` e `confirmByToken`, mas:  
  - `createConfirmation` não era usado na agenda.  
  - Não existia fluxo no portal para o cliente confirmar pelo link.  
  - A tabela `appointment_confirmations` e um RPC público para confirmar pelo token não estavam documentados/criados no projeto.

**Alterações feitas:**

1. **SQL (`supabase-appointment-confirmations.sql`):**
   - Tabela `appointment_confirmations` (org_id, appointment_id, token, confirmed_at, created_at).
   - RLS para membros da org (staff).
   - RPC **`confirm_appointment_by_token(p_token text)`** (SECURITY DEFINER) para o cliente confirmar pelo link sem login staff. Retorna `{ ok: true }` ou `{ ok: false, error: "..." }`.

2. **Portal (`js/Client/`):**
   - **client-portal.service.js:** Nova função `confirmarHorarioByToken(confirmToken)` que chama a RPC `confirm_appointment_by_token`.
   - **portal.js:** No bootstrap, se a URL tiver `?confirmToken=xxx`, chama `confirmarHorarioByToken`, exibe toast de sucesso ou erro, remove o parâmetro da URL e mostra uma tela simples ("Confirmação de horário – pode fechar a página"). Quem acessar só o link de confirmação não precisa do token de sessão do portal.

3. **Agenda (dashboard staff):**
   - Ao clicar no botão WhatsApp do evento, além do telefone é lido o `data-id` do card (id do agendamento).
   - Chama `createConfirmation(appointmentId)` para gerar um token de confirmação.
   - Monta a mensagem com o link:  
     `{origin}/portal.html?confirmToken={token}`  
     e envia via `sendWhatsapp(tel, mensagem)`.
   - Se `createConfirmation` falhar (ex.: tabela ainda não criada), continua enviando só o lembrete fixo.

4. **WhatsApp (serviço):**
   - Comentário explicando que a integração é simulação (grava em `whatsapp_logs`; integração real exige API externa).
   - Tratamento de erro no insert em `whatsapp_logs` (evita quebrar se a tabela não existir).
   - Uso de `user?.id ?? null` para não quebrar se não houver usuário.

---

## 4. Fluxo completo (confirmação de horário)

1. Staff abre a **Agenda**, vê o evento e clica no botão **WhatsApp** (📲).
2. O sistema gera um token em `appointment_confirmations` e envia uma mensagem com o link do portal + `confirmToken=...`.
3. O cliente recebe a mensagem (quando a integração WhatsApp real estiver ativa) e clica no link.
4. Abre o portal em `portal.html?confirmToken=xxx`; o bootstrap chama a RPC, marca `confirmed_at` e exibe "Horário confirmado! Obrigado." (ou mensagem de erro se o link for inválido/já usado).

---

## 5. O que ainda depende de configuração

- **WhatsApp real:** O envio efetivo para o número do cliente depende de integração com API (ex.: Twilio, Evolution API). O código apenas monta a mensagem (incluindo o link) e grava em `whatsapp_logs` (ou ignora se a tabela não existir).
- **Tabela `whatsapp_logs`:** Se não existir, o log não é gravado, mas o fluxo da agenda e do portal não quebra.
- **Tabela `appointment_confirmations` e RPC:** É preciso rodar **`supabase-appointment-confirmations.sql`** no Supabase para o link de confirmação e o portal funcionarem. A ordem sugerida está em `supabase-ordem-scripts.md`.

---

## 6. Arquivos alterados / criados

| Arquivo | Alteração |
|--------|------------|
| `js/Client/dashboard.client.js` | Terceiro parâmetro `hasSkincareRotina` em `renderDashboard` e uso no template. |
| `js/Client/client-portal.service.js` | Função `confirmarHorarioByToken(confirmToken)`. |
| `js/Client/portal.js` | Tratamento de `?confirmToken=` no bootstrap; chamada a `confirmarHorarioByToken` e tela de confirmação. |
| `js/views/agenda.views.js` | Uso de `appointmentId` no botão WhatsApp; `createConfirmation`; mensagem com link. |
| `js/services/whatsapp.service.js` | Comentário, tratamento de erro no insert, `user?.id` opcional. |
| `supabase-appointment-confirmations.sql` | **Novo:** tabela + RPC `confirm_appointment_by_token`. |
| `supabase-ordem-scripts.md` | Inclusão do script de appointment_confirmations. |

---

## 7. Contato com o cliente – resumo

| Canal | Onde | Status |
|-------|------|--------|
| **Portal – mensagens** | #mensagens (Fale com a clínica) | OK; usa `sendClientMessage` → `report_client_event`. |
| **Portal – relatar evento** | Dashboard → Relatar evento | OK; usa `reportClientEvent(tipo, desc)`. |
| **Portal – confirmar horário** | Link no WhatsApp → portal.html?confirmToken= | Novo; RPC + tratamento no bootstrap. |
| **WhatsApp (staff → cliente)** | Agenda → botão 📲 | OK; mensagem agora pode incluir link de confirmação; envio real depende de API externa. |
