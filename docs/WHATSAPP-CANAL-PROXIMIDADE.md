# WhatsApp como canal de proximidade entre clínica e cliente

O **WhatsApp** é o canal que mais aproxima a empresa do cliente no Brasil: o cliente já usa no dia a dia, responde rápido e confirma presença com um clique quando a mensagem traz o link certo.

---

## O que o sistema já faz (sem custo de API)

- **Botão 📲 na agenda:** ao clicar, o sistema **abre o WhatsApp** (Web ou app) no número do cliente com a **mensagem pronta** (lembrete + link de confirmação). A recepção só precisa clicar em **Enviar** no WhatsApp.
- **Botão 📋 Lembrete:** copia a mesma mensagem e também abre o WhatsApp se o cliente tiver telefone.
- **Link de confirmação:** a mensagem inclui um link único. O cliente abre no celular, clica em **Confirmar** e a clínica vê a confirmação sem precisar de API.

Assim, a **melhor função para aproximar** já está no app: **um clique na agenda** → abre o chat com o cliente e a mensagem personalizada (nome, data, hora, link). Custo zero; só é preciso enviar pelo seu WhatsApp.

---

## Por que o WhatsApp funciona melhor

| Vantagem | Explicação |
|----------|------------|
| **Onde o cliente está** | Quase todo mundo usa WhatsApp; abrir o app é natural. |
| **Resposta rápida** | Confirmação em um toque no link; menos no-show. |
| **Canal único** | Lembrete, confirmação e dúvidas no mesmo lugar. |
| **Personalizado** | Mensagem com nome, data, hora e nome da clínica. |

---

## Fluxo hoje (recomendado para a clínica)

1. Na **Agenda**, no dia, a recepção vê os agendamentos.
2. Clica em **📲** (ou **📋 Lembrete**) no atendimento.
3. Abre o **WhatsApp** com o número do cliente e o texto já preenchido (com link de confirmação).
4. Clica em **Enviar** no WhatsApp.
5. O cliente recebe, clica no link e **confirma** a presença.

Nenhuma API de WhatsApp é necessária para esse fluxo; o sistema só abre o `wa.me` com a mensagem certa.

---

## Próximo passo: envio automático (opcional)

Se quiser que o **sistema envie** a mensagem sozinho (sem alguém clicar em 📲 por agendamento):

1. **Contratar acesso à API do WhatsApp:**  
   - [Meta – WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp) (direto), ou  
   - Provedor (BSP): [Twilio](https://www.twilio.com/whatsapp), [Take Blip](https://blip.ai), etc.
2. **Montar o envio no backend:** uma Edge Function ou API que, com o número e o texto (o mesmo que hoje abrimos no `wa.me`), chame a API e envie a mensagem.
3. **Agendar um job:** cron (ex.: todo dia às 18h) que busca os agendamentos do dia seguinte e chama esse backend para cada cliente.

O **texto da mensagem** (lembrete + link de confirmação) já está definido no app; a única mudança é **quem envia**: hoje é o usuário pelo WhatsApp dele; com API, é o sistema pelo número comercial da clínica.

---

## Resumo

- **Melhor função para aproximar empresa e cliente:** usar o **botão 📲 (WhatsApp)** na agenda — abre o chat com a mensagem pronta e o link de confirmação.
- **Hoje:** um clique na agenda → WhatsApp abre → enviar a mensagem. Custo zero, canal de proximidade.
- **Depois (opcional):** integrar API do WhatsApp para envio automático de lembretes; o guia técnico está em **INFRA-LEMBRETE-E-WHATSAPP.md**.