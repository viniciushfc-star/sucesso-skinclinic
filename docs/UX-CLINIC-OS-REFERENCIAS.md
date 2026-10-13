# SkinClinic — o que copiar do moodboard (e o que não)

**Data:** 2026-09-29  
**Uso:** briefing curto para layout. Não é backlog de 22 telas novas.

## Tese

Não é “sistema genérico de clínica”. É **Clinic OS**: paciente → avaliação → anamnese → plano → protocolo → aplicado → estoque → custo → financeiro → margem → CRM → inteligência.

Frase de produto: **Da avaliação ao resultado. Tudo conectado.**

Não reconstruir o SPA. Refinar o que já existe (80% fluxo / 20% visual).

## Copiar (princípio, não pixel)

- Poucos números no topo; o restante é **ação** (confirmar, encaixar, repor, cobrar).
- Hierarquia forte, muito espaço, tabelas inteligíveis, hover com Ver / Agendar / WhatsApp.
- Calendário tipo clínica premium: colunas de profissional, dia/semana, bloco do horário — não grade lotada de widgets.
- Paciente 360: um perfil, abas, timeline, antes/depois. Mapa/fotos de pele como **apoio**, não como produto à parte.
- Cockpit “Hoje”: agenda do dia + atenção + oportunidade. Sem pizza de 15 cards.
- Portal do paciente **diferente** do painel da clínica (próximo horário, sessões, evolução). Sem `ia_preliminar`.
- Tokens: fundo off-white, branco, grafite, teal sofisticado, violeta só na IA, âmbar/vermelho para estado. Cor nunca é o único sinal.
- Design system **antes** de tela solta: mesmo botão, mesma tabela, mesmo modal em todos os módulos.

Tokens atuais (`js/css/design-system.css`): papel `#f4efe8`, teal `#0f5c62`, Inter — já estão nessa família. Ajustar, não trocar por template Linear/Stripe.

## Não copiar

- Visual Linear/Attio/Notion/Apple **literal** (sidebar idêntica, dark “mission control”, kanban de software).
- Dashboard médico azul + gráficos de pizza + menu genérico.
- 22 mockups isolados (cada um parece outro produto).
- Item de menu **Atendimentos** se for só duplicar Agenda + protocolo aplicado.
- Chat “pergunte qualquer coisa” no vazio. IA **contextual** na tela/registro; sugere; humano confirma.
- Campanha WhatsApp em massa / “criar e disparar 32 mensagens”. Régua e silêncio humano continuam.
- IA que grava preço ou lança estoque/financeiro sozinha. OCR sempre com **Revisar**.
- Onboarding teatral que “cria a clínica inteira” em 4 passos. Manter onboarding mínimo.
- P3: pagamento in-app, NFS-e, loja, bot WhatsApp, multiunidade.

## Já está no produto (renomear / limpar)

| Visão do moodboard | Onde está hoje |
|---|---|
| Hoje / cockpit | `#dashboard` |
| Pacientes + 360 | `#clientes` + perfil |
| Agenda | `#agenda` |
| Plano / protocolo / aplicado | rotas e serviços já existentes |
| Relacionamento | `#crm` |
| Gestão | financeiro, precificação, estoque, procedimentos, equipe |
| Inteligência | Copiloto, marketing, insights no cockpit |
| Portal | `portal.html` |

## Ordem se for implementar visual

1. Tokens + shell (sidebar, header). Dashboard passa a se chamar **Hoje**. Sem rota nova. **Feito em 2026-09-29** (`dashboard.html` + `design-system.css`).
2. Lista de pacientes + perfil 360 mais calmos. **Feito em 2026-09-29** (hover Ver / Agendar / WhatsApp; abas e ações do perfil).
3. Agenda usável (provar no browser antes de polir o resto).
4. Golden Flow visível no perfil (plano ≠ protocolo ≠ aplicado).
5. IA **dentro** das telas, não um módulo “Skin AI” solto.
6. Portal por último.

## Prompt para outra IA (3 linhas)

Não inventar tela. Usar este doc + o código. Mesmo design system. Plano ≠ protocolo ≠ aplicado. IA sugere, humano decide. Sem WhatsApp em massa. Sem preço automático. Sem expor preliminar de IA no portal.
