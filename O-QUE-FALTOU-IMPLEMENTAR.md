# O que faltava implementar (gap com o mercado) — status

Resumo do que foi feito e do que ainda falta em relação às melhorias sugeridas (MELHORIAS-SUGERIDAS, ANALISE-MATURIDADE, AVALIACAO-HOJE).

---

## ✅ Já implementado

| Item | Onde | Observação |
|------|------|------------|
| **Lembrete manual com link de confirmação** | Agenda → botão Lembrete e 📲 | Mensagem inclui link para cliente confirmar em um clique no portal. |
| **Registro "lembrete enviado"** | Coluna `agenda.reminder_sent_at` | Exibe "✓ Lembrete" no card do dia. SQL: `supabase-agenda-reminder-sent.sql`. |
| **Fotos antes/depois no perfil** | Cliente → aba Histórico → Fotos antes/depois | Lista, adicionar (data, tipo, procedimento, arquivo), excluir. SQL: `supabase-client-evolution-photos.sql`. |
| **Comparativo antes/depois (fotos)** | Cliente → Fotos antes/depois → Comparar | Botão "Comparar fotos": escolher 2 fotos e ver lado a lado. |
| **Filtro de período no dashboard** | Dashboard | Select Hoje/Semana/Mês/Personalizado já altera métricas e gráficos. |
| **"Meu previsto hoje"** | Dashboard | Card exibido quando o usuário tem permissão agenda:view e modelo de pagamento com %. |
| **Central de ajuda / FAQ** | Para clínicas (menu + Configurações) | FAQ, atalhos, tutorial, texto de suporte. |
| **Relatório procedimentos realizados** | Procedimentos → Relatório (período) | Filtro por datas e profissional, tabela e Exportar CSV. |
| **Contas a pagar → saída no financeiro** | Financeiro → Editar conta | Ao marcar como Pago, uma saída é registrada automaticamente. Texto de ajuda no modal. |

---

## ⏳ Ainda não implementado (próximos passos)

| Item | Dificuldade | O que falta |
|------|-------------|-------------|
| **Lembrete automático** (envio X horas antes) | Média–alta | Job/cron (ex.: Supabase Edge Function ou servidor) que rode periodicamente, busque agendamentos nas próximas X horas e **envie** mensagem (WhatsApp API ou e-mail). Hoje o envio é manual (botão). |
| **Integração WhatsApp API** | Média | Conta WhatsApp Business, API (ex.: Twilio, oficial), envio automático. Hoje: abrir WhatsApp com mensagem pronta. |
| **Notoriedade (fora do produto)** | N/A | Site, trial, depoimentos, parcerias — não é feature de código. |

---

## Resumo

- **Fechado no produto:** lembrete manual com link, fotos antes/depois, comparar fotos, filtro de período no dashboard, "Meu previsto hoje", Central de ajuda, **relatório de procedimentos realizados**, contas a pagar → saída automática.
- **Próximo passo de produto:** lembrete automático + WhatsApp API (depende de infra e contrato com canal).
