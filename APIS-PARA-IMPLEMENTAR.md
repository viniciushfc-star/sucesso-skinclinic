# APIs para implementar no SkinClinic

Use este arquivo para anotar **quais APIs são melhores** para cada integração e em que ordem implementar. Preencha os blocos abaixo com nome, link, prós/contras e prioridade.

---

## Como usar

- **Prioridade:** 1 = implementar primeiro, 2 = em seguida, etc.
- **Status:** `[ ]` não começou | `[~]` em estudo | `[x]` implementado
- **Arquivos no projeto:** anote o caminho dos arquivos onde a API será usada (ex.: `api/`, `js/services/`).

---

## 1. Nota fiscal (NFS-e / NF-e)

*Emissão de nota a partir dos atendimentos; link atual em Configurações → Empresa.*

| Prioridade | API / provedor | Site / doc | Por que é boa | Arquivos onde integrar | Status |
|------------|----------------|------------|---------------|------------------------|--------|
| 1 | *ex.: Nota Control, Focus NFe, prefeitura* | | | `api/`, view Notas fiscais | [ ] |
| 2 | | | | | [ ] |
| 3 | | | | | [ ] |

**Notas:**
- 


---

## 2. Pagamento (maquininha / gateway)

*Cobrança no app; hoje há ideia em standby (PAGAMENTO-IDEIA-STANDBY.md).*

| Prioridade | API / provedor | Site / doc | Por que é boa | Arquivos onde integrar | Status |
|------------|----------------|------------|---------------|------------------------|--------|
| 1 | *ex.: Stripe, PagSeguro, Mercado Pago, Asaas* | | | `api/`, view Pagamento | [ ] |
| 2 | | | | | [ ] |
| 3 | | | | | [ ] |

**Notas:**
- 


---

## 3. Agenda / calendário

*Já existe integração Google Calendar (api/google-calendar/, GOOGLE-CALENDAR-SYNC.md). Outras opções para “quem está disponível”.*

| Prioridade | API / provedor | Site / doc | Por que é boa | Arquivos onde integrar | Status |
|------------|----------------|------------|---------------|------------------------|--------|
| 1 | Google Calendar | já em uso | sync blocos de indisponibilidade | `api/google-calendar/`, `js/services/google-calendar.service.js` | [x] |
| 2 | *ex.: Outlook, Calendly, outro* | | | | [ ] |
| 3 | | | | | [ ] |

**Notas:**
- 


---

## 4. Estoque / compras

*Ler nota fiscal (OCR já existe); eventualmente integração com fornecedor ou sistema de compras.*

| Prioridade | API / provedor | Site / doc | Por que é boa | Arquivos onde integrar | Status |
|------------|----------------|------------|---------------|------------------------|--------|
| 1 | *ex.: API do fornecedor, NF-e autorizada* | | | `api/`, `js/services/estoque-entradas.service.js` | [ ] |
| 2 | | | | | [ ] |

**Notas:**
- 


---

## 5. Comunicação (WhatsApp / SMS / e-mail)

*Lembretes, aniversário, confirmação de agendamento.*

| Prioridade | API / provedor | Site / doc | Por que é boa | Arquivos onde integrar | Status |
|------------|----------------|------------|---------------|------------------------|--------|
| 1 | *ex.: Twilio, WhatsApp Business API, SendGrid* | | | `api/`, views Agenda / Clientes | [ ] |
| 2 | | | | | [ ] |

**Notas:**
- 


---

## 6. Outras (CRM, contabilidade, assinatura digital, etc.)

| Prioridade | API / provedor | Site / doc | Por que é boa | Arquivos onde integrar | Status |
|------------|----------------|------------|---------------|------------------------|--------|
| 1 | | | | | [ ] |
| 2 | | | | | [ ] |

**Notas:**
- 


---

## Ordem sugerida de implementação (exemplo)

1. **Nota fiscal** – clínicas precisam emitir NFS-e; já há tela e campo de link; integração direta aumenta percepção de “sistema completo”.
2. **Pagamento** – receber pelo app (taxa melhor em volume); depende de decisão de produto (PAGAMENTO-IDEIA-STANDBY.md).
3. **Comunicação** – lembretes e aniversário já têm fluxo; API de envio automatiza e escala.

---

## Onde ficam as APIs no projeto

- **Backend (Node):** `api/` — um arquivo ou pasta por domínio (ex.: `api/google-calendar/`, `api/analise-pele.js`).
- **Frontend:** `js/services/*.service.js` — chamadas ao backend ou a APIs externas com auth quando necessário.
- **Rotas:** `ROUTES.md` e servidor (ex.: `serve.json` ou equivalente) para expor `/api/...`.

Atualize este arquivo conforme definir as APIs e a ordem de implementação.
