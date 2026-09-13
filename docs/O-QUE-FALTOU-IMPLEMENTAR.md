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
| **Anamnese à distância** | Portal do cliente | Ficha em casa; aparece no prontuário com selo “Preenchida pelo cliente”. SQL: `supabase-anamnese-portal.sql`. |

---

## ⏳ Ainda não implementado (próximos passos)

| Item | Dificuldade | O que falta |
|------|-------------|-------------|
| **Lembrete automático** (envio X horas antes) | Média | **Feito no código:** Vercel Cron diário + botão em Empresa. Falta só preencher as variáveis na Vercel e a conta Meta. |
| **Integração WhatsApp API** | Média | Endpoint `/api/whatsapp-send` + Cloud API. Sem `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID`, cai no `wa.me`. |
| **Notoriedade (fora do produto)** | N/A | Site, trial, depoimentos, parcerias — não é feature de código. |

---

## Resumo

- **Fechado no produto:** lembrete manual com link, **anamnese à distância no portal**, fotos antes/depois, comparar fotos, filtro de período no dashboard, "Meu previsto hoje", Central de ajuda, **relatório de procedimentos realizados**, contas a pagar → saída automática.
- **Próximo passo de infra:** configurar `CRON_SECRET` + Resend e/ou WhatsApp Cloud API e agendar `/api/lembretes-auto`.
