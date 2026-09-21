# Mapa de integrações SkinClinic — 2026

Status: CÓDIGO / ENV necessário / LIVE = NÃO COMPROVADO salvo onde dito.

| Integração | Onde | Auth | O que faz | Completa? |
|------------|------|------|-----------|-----------|
| Supabase Auth | js/core/auth.js | sessão | login | CÓDIGO |
| Supabase DB | services | anon+RLS | CRUD | CÓDIGO; live NÃO COMPROVADO |
| Supabase Storage | fotos, logos, pele | policies | | CÓDIGO + SQL; live NÃO COMPROVADO |
| OpenAI | `ai/core`, rotas | `OPENAI_*` | vários prompts | CÓDIGO; custo `ai_usage_events` |
| Google Cloud Vision | `api/ocr` / routes/ocr | credencial | OCR | optionalDependency; sem key = degradar **NÃO COMPROVADO** fluxo erro |
| WhatsApp Cloud | whatsapp-send | WHATSAPP_TOKEN, PHONE_ID | envio | senão **wa.me** (não é API) |
| Resend / e-mail convite | send-invite-email, lembretes | env | | CÓDIGO; live NÃO COMPROVADO |
| Vercel Cron | vercel.json `0 11 * * *` | CRON_SECRET | lembretes-auto todas orgs | CÓDIGO |
| Google Calendar | routes/google-calendar/* | OAuth state assinado | sync/disconnect/status | CÓDIGO; E2E NÃO COMPROVADO |
| Webhook transações | webhook-transacoes | WEBHOOK_TRANSACTIONS_SECRET | insert financeiro | CÓDIGO; agregador (Belvo/Pluggy) **não** implementado no repo — só receptor |
| Edge `dynamic-api` | user.service inviteUser | functions.invoke | convite | **LEGADO**; pode 404 |
| Push | push.service | | | PARCIAL / NÃO COMPROVADO |
| Pagamento app | flag false | | | IDEIA / STANDBY |
| NFS-e | APIS-PARA-IMPLEMENTAR `[ ]` | | | DOCUMENTADO |
| Market dados externos | | | | AUSENTE |

`GET /api/integracoes-status` devolve **booleanos** (secret configurado sim/não), não o valor do secret — adequado.

**Não inventar** que WhatsApp Cloud, Calendar ou Vision estão “ligados em produção”: **NÃO COMPROVADO** sem env live.
