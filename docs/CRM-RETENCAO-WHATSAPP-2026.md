# CRM, retenção e WhatsApp — 2026

## CRM hoje

- `crm.service.js`: última visita via `agenda` (limite 8000 linhas), inativos por `minDays` (cockpit usa **90**).  
- `waitlist.service.js` / `agenda_waitlist`.  
- Fidelidade visitas + brinde aniversário em `organizations` (`organization-profile.service.js`; parte em **localStorage** se coluna falhar).  
- Pacotes: `pacotes.service.js`.  
- Eventos: `client_events`, `report_client_event`.  
- Sem segmentos VIP/EM RISCO/PACOTE ATIVO como modelo.

## Radar alvo (P1)

Sinais: nova sem 2º, recorrente, atrasada vs intervalo **mediano pessoal** (mín. N visitas), pacote incompleto, sem próxima sessão, inativa (limiar **configurável**).

Ações sugeridas, **nunca** envio automático sem opt-in + permissão + template.

## WhatsApp hoje

- Default `wa.me` (`whatsapp.service.js`).  
- Cloud: `WHATSAPP_TOKEN` + `/api/whatsapp-send`.  
- Cron lembretes: `/api/lembretes-auto`.  
- `message_templates`, `whatsapp_logs` (RLS se migration 20260920).  
- Confirmação: link portal.

**Não há** jornada: pós-procedimento, pesquisa, indicação, reativação como automações de produto.

## Integração alvo

CRM gera **fila**. Intelligence prioriza. WhatsApp é canal. Agenda marca `reminder_sent_at`. Sem isso, WhatsApp é commodity e risco LGPD.
