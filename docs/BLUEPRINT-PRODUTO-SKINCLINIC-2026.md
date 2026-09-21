# Blueprint de produto SkinClinic — 2026

**Não implementar nesta etapa.** Fonte de verdade de produto: canônicos `.cursor/rules` + `PLANO` + `PROTOCOLO` + `FINANCEIRO` + `OCR`. Este blueprint **preserva** o que já opera e **liga** o grafo.

---

## SKINCLINIC NÃO É

- Agenda + WhatsApp + caixa (Fresha/Trinks).  
- Prontuário que ignora margem.  
- ERP fiscal.  
- Marketplace de horários.  
- ChatGPT com login.  
- Sistema que **altera preço** ou **dispara campanha** sozinho.  
- Gamificação infantil.  
- Dados de mercado inventados.

## SKINCLINIC É

O sistema operacional da clínica de estética:

**CLÍNICA → DADOS → CONTEXTO → INTELIGÊNCIA → AÇÃO → RESULTADO → NOVOS DADOS → APRENDIZADO**

Promessa externa: “Da avaliação ao resultado, tudo conectado.”  
Promessa interna: o gestor entende o que aconteceu e o próximo passo — a decisão continua humana.

Tese econômica: **ganhar mais + trabalhar melhor + perder menos + reter + conhecer a operação.**

---

## Arquitetura de domínio (alvo)

```
CLIENTE
  → AGENDA (atendimento operacional)
    → ANAMNESE / AVALIAÇÃO / ANÁLISE (validadas)
      → PLANO (o que combinamos)
        → PROTOCOLO (como executar)
          → PROTOCOLO APLICADO (o que ocorreu)
            → ESTOQUE (consumo)
              → CUSTO → PREÇO (simulação) → MARGEM
                → FINANCEIRO (receita da sessão)
                  → CRM / RETORNO
                    → METAS
                      → SKINCLINIC INTELLIGENCE
                        → MARKETING / WHATSAPP (só com opt-in)
```

Cada seta é um **contrato de dados**, não um menu.

---

## Distinções travadas

| Conceito | Tabela/código hoje | Contrato |
|----------|-------------------|----------|
| Atendimento | `agenda` | Evento operacional (horário, status, profissional, sala) |
| Plano | `planos_terapeuticos` | O que será realizado/vendido com lógica terapêutica |
| Protocolo | `protocolos` + descartáveis | Método |
| Aplicado | `protocolos_aplicados` | Fato clínico + insumo |
| Evolução | `client_evolution_photos`, anamnese, aplicado | Resultado no tempo |

**Canônico de agendamento:** `agenda`. `appointments` é inconsistência a eliminar (não nesta etapa).

---

## Camada Intelligence

Uma inteligência, vários sensores. Não N copiloto-telas.  
Copilot clínico = explica dados internos.  
Market Radar = módulo **separado** com fonte.  
Dashboard = HOJE / MÊS / ATENÇÃO / OPORTUNIDADES / METAS / PREVISÕES.

Priorizar insights (teto diário). Sem spam.

---

## Segurança e tenant

`user → organization → (futuro) unit`. Hoje **não há** `unit_id`. Multiunidade é P3; multi-org já existe.

Ingresso: convite + aceite. Frontend não autoriza. Produção: catálogo de permissões **fail-closed** (decisão registrada vs código atual).

---

## O que preservar vs reconstruir

**Preservar:** fluxo clínico validado, estoque não bloqueante, flags de pagamento/contabilidade off, trigger de consumo, CSV, cockpit, margem-em-risco embrião.

**Reconstruir (ligar, não duplicar):** motor de custo no procedimento; radar de retorno; setup progress; Intelligence; schema único.

**Não construir agora:** XP, Market Radar sem fonte, segundo financeiro, Prisma/React da anamnese.
