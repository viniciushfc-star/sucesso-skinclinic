# CRM e retenção SkinClinic 1.0

**Data:** 2026-09-20  
**Estado:** PARCIAL. Embrião: inativos 90d, waitlist, fidelidade por visitas, brinde aniversário, cockpit.

---

## Radar de retorno (P1)

Identificar, com regras explícitas e dados da org:

| Sinal | Base |
|-------|------|
| Atrasada | Último atendimento + intervalo mediano pessoal (mín. N visitas) |
| Pacote incompleto | `client_packages` / consumos |
| Tratamento sem próxima sessão | Plano/agenda futura vazia |
| Inativa | Sem visita no limiar configurável (hoje 90d hardcoded no CRM) |
| Recorrente | Frequência estável |
| Nova sem 2º atendimento | Primeira visita, sem retorno |

Segmentos alvo: ATIVA, EM RISCO, INATIVA, REATIVAÇÃO, VIP, NOVA, PACOTE ATIVO.

VIP: regra da clínica (ticket, indicação, frequência) — não inventar.

## Ações sugeridas

“Entrar em contato”, “Agendar retorno”, “Enviar mensagem”, “Oferecer avaliação”.

**Nunca** envio automático sem canal configurado + opt-in + permissão.

## Relação com Marketing Intelligence

Radar gera **lista**. Marketing Intelligence (P2) sugere campanha com objetivo, público, custo estimado, métrica, prazo, risco, como medir — sem prometer resultado.

## Canônico

Não transformar CRM em spam. WhatsApp continua opt-in. Copilot explica “por que esta paciente aparece aqui”.
