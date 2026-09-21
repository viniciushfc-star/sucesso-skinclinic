# Mapa de funcionalidades SkinClinic — 2026

Legenda: 🟢 implementado · 🟡 parcial · 🔵 só doc/ideia · 🟠 inconsistente · 🔴 ausente crítico · ⚫ obsoleto/duplicado

Colunas: Área | Feature | Visão | FE | BE/API | Banco | Migration oficial | RLS (script) | Docs | Funcional? | Parcial? | Quebrado? | Dup? | Deps | Risco | Impacto | Prio | Diferencial? | Genérico vs inteligente | Fazer

“Migration oficial” = `supabase/migrations/` (3 arquivos). SQL avulso ≠ migration.

---

## Núcleo operacional

| Área | Funcionalidade | Visão original | FE | BE | Banco | Mig | RLS | Docs | Status | Dup | Deps | Risco | Impacto | P | Dif? | G/I | Fazer |
|------|----------------|----------------|----|----|-------|-----|-----|------|--------|-----|------|-------|---------|---|------|-----|-------|
| Cliente | Cadastro `clients` | Núcleo da jornada | sim `clientes.views.js` | browser CRUD | `clients` | não | scripts rls-clients | APP-VISAO | 🟢 | ⚫ fallback `clientes` | org | IDOR se RLS | alto | P0 | B | genérico | Unificar `clientes` |
| Cliente | Perfil + abas | História do cliente | `cliente-perfil.views.js` | — | várias | não | por tabela | canônico | 🟡 | | anamnese, pacotes | perda de contexto | alto | P1 | C | intelig. se ligado | Jornada na ficha |
| Cliente | CPF duplicado | qualidade | sim | — | unique? | não | | | 🟡 | | | | médio | P1 | B | | Garantir unique org+cpf |
| Jornada | Lead → recompra | tese 2026 | fragmentada | — | eventos parciais `client_events` | não | | | 🟠 | | | | alto | P1 | D | genérico hoje | Ver JORNADA-CLIENTE |
| Agenda | Grade / CRUD | OS do dia | `agenda.views.js` | — | `agenda` | não CREATE nas 3 | `rls-agenda` | AGENDA-MODELO | 🟢 | ⚫ `appointments` | clients, procedures | confirm em tabela errada | alto | P0 | A | genérico | Canônico `agenda` |
| Agenda | Waitlist | ocupação | CRM + service | — | `agenda_waitlist` | não | sim scripts | | 🟡 | SQL dup | | | médio | P1 | B | | Ligar Intelligence |
| Agenda | Confirmação token | reduzir no-show | portal RPC | — | `appointment_confirmations` | não | | | 🟡 | | portal | | médio | P1 | B | | |
| Agenda | Google Calendar | bloqueios | sim | `/api/google-calendar*` | `google_calendar_connections`, `external_calendar_blocks` | P1 mig | owner policy | GOOGLE-CALENDAR | 🟡 | | OAuth | token leak | médio | P1 | B | | |
| Agenda | Lembrete auto | WhatsApp/email | Empresa | cron `/api/lembretes-auto` | `reminder_sent_at` | não | | INFRA-LEMBRETE | 🟡 | | env Meta/Resend | spam LGPD | médio | P1 | B | | Opt-in |
| Atendimento | Status / atraso | cockpit | `cockpit-status.js` | — | campos agenda | não | | | 🟡 | | | | alto | P1 | C | intelig. | |
| Anamnese | Fichas modulares | cuidado | `anamnese.views.js` | — | `anamnesis_*` | não | scripts | ANAMNESE-MODULAR | 🟢 | 🔵 Prisma/React ideia | cliente | dados sensíveis | alto | P1 | C | intelig. | Manter SPA |
| Anamnese | Portal (casa) | alcance | portal | RPC `submit_anamnese_by_token` | registros | não | | | 🟢 | | token | | alto | P1 | C | | |
| Análise pele | Preliminar+validação | IA auxilia | staff + portal | `/api/analise-pele*` | `analise_pele` | P1 parcial RPC | sim | analise-pele-ia-canon | 🟢 desenho | | storage | vazamento preliminar | alto | P0 | **C** | intelig. | Não expor ia_preliminar |
| Plano | Terapêutico | PLANO-CANONICO | `planos.views.js` | — | `planos_terapeuticos` | não | | PLANO-CANONICO | 🟡 | | procedures | plano ≠ protocolo | alto | P1 | **C** | intelig. | Ligar à ficha/agenda |
| Protocolo | Método + IA texto | PROTOCOLO canon | `#protocolo` + ficha | `/api/protocolo` | `protocolos`, `protocolos_ia` | não | sim | protocolo-canon | 🟠 menu vs ficha | | | confusão oferta | alto | P1 | **C** | | Atalho agenda |
| Protocolo aplicado | Fato + estoque | proteção empresa | ficha | trigger SQL | `protocolos_aplicados` | não | sim | | 🟡 | | estoque | trigger off = custo mente | alto | P1 | **C** | intelig. | Garantir trigger |
| Evolução | Fotos antes/depois | resultado | perfil | storage | `client_evolution_photos` | não | | | 🟢 | | | fotos clínicas | alto | P1 | C | | buckets privados |
| Skincare | Rotina + liberação | rascunho staff | `#skincare` | `/api/skincare` | `skincare_rotinas` | não | sim | SKINCARE-IDEA | 🟡 | | | | médio | P1 | C | | |
| Dashboard | Cards + gráficos | métricas | `dashboard.views.js` | — | counts | — | | | 🟠 | cockpit | select * | | médio | P1 | A | genérico | Subordinar a cockpit |
| Dashboard | Cockpit Hoje/Atenção | “o que olhar” | sim | — | agenda, crm, contas | — | | docs 1.0 | 🟡 | header cards | | | alto | P1 | **C** | intelig. | Completar Mês/Metas |
| Relatórios | Proc. realizados + CSV | | procedimentos, export | — | | | | O-QUE-FALTOU | 🟡 | | | | médio | P2 | A | | |
| Notificações | Lista | | `#notificacoes` | — | `notificacoes` | não | sim base | | 🟡 | | | | baixo | P2 | A | | Anti-spam |
| Onboarding | Nome da org | criar clínica | `onboarding.html` | — | organizations | não | rls-org | ROUTES | 🟡 | | | | alto | P1 | B | genérico | Setup progress |
| Setup custos | Checklist fixos | | aba financeiro `setup-inicial.views.js` | — | lançamentos `financeiro` | não | | | 🟡 | | | rateio ausente | alto | P1 | C | | Metodologia |
| Import CSV | Clientes/agenda/fin/proc | migração | `#export` | — | várias | não | | ANALISE-MATURIDADE | 🟡 | | | sem rollback | alto | P1 | **C** onboarding | Preview+log |
| Migração IA | arquivo→mapa | briefing | não | não | não | não | | | 🔵 | | | | médio | P2 | C | | Depois CSV sólido |
| Multi-org | Troca org | tenant | select-org | JWT org | organization_users | P0 convite | sim | | 🟢 | ≠ multiunidade | | self-join | alto | P0 | B | | Convite único |
| Multiunidade | Filial | docs mercado | não | não | sem unit | | | VEREDITO-MERCADO | 🔵 | multi-org | | | baixo agora | P3 | | | Não agora |
| Permissões | Role + override | | `permissions.js` | `api-auth.js` | `organization_user_permissions` | não | script | REVISAO-PERMISSOES | 🟠 fail-open | staff/funcionario | | 🔴 prod | alto | P0 | B | | Fail-closed prod |
| Equipe | Membros, salas, afazeres | EQUIPE-CANON | team views | — | organization_users, salas, afazeres, team_payment_models | não | sim | EQUIPE-CANONICO | 🟡 | invite Edge | | | médio | P1 | B | | |
| Equipe | Comissão / pagamento | | perfil profissional | — | team_payment_models | não | | | 🟡 | | | | médio | P1 | C | | Ligar ao custo/hora |
| LGPD | Termos, consentimento | | documentos, portal | RPC sign | organization_legal_documents | não | | TERMO-* | 🟡 | | | incompleto exclusão | alto | P1 | B | | Export/erase |
| Segurança API | JWT Bearer | | | `lib/api-auth.js` | | | | SEGURANCA-API | 🟢 | | | fail-open perm | alto | P0 | B | | |
| Auditoria | audit_logs | trilha | `#auditoria` | browser insert | `audit_logs` | não | scripts | | 🟡 user pode inserir | ⚫ `logs` | | adulterável | alto | P0 | B | | Append-only server |
| Backup | JSON tabelas | | backup.views | | clients, agenda, financeiro | | | | 🟡 restore perigoso | | | | médio | P0 | A | | Restore seguro |
| PWA | SW | mobile | `sw.js` | | | | | ROUTES desatualizado | 🟢 network-first | | | cache antigo | médio | P1 | A | | Atualizar ROUTES.md |
| Feature flag | Pagamento app | standby | `pagamento.views.js` | payments.service | | | | PAGAMENTO-IDEIA | 🔵 flag false | | | | — | P3 | | | Manter off |
| Feature flag | Contabilidade interna | | financeiro-contador | fiscal.service | fiscal_* | | | | 🔵 flag false | | | | — | P3 | | | Manter off |
| Billing limits | assinaturas | | limits.service | | `assinaturas` | ? | | | ⚫ órfão | | | | baixo | P3 | | | Não usar |
| QA | catálogo ~1400 | | scripts/qa | | | | | | 🟡 ≠ RLS | | | falsa segurança | médio | P0 | | | E2E+RLS |
| Observabilidade | custo IA | | | openai-cost + ai_usage_events | P1 mig | RLS | | 🟡 | | | logs sensíveis | médio | P1 | | | 5xx/latency |
| Integrações | status | | | GET integracoes-status | | | | | 🟡 | | | | baixo | P2 | | | |

---

## Estoque, custo, preço, financeiro

| Área | Feature | Visão | FE | API | Banco | Mig | RLS | Docs | Status | Dup | Fazer |
|------|---------|-------|----|-----|-------|-----|-----|------|--------|-----|-------|
| Estoque | Entradas lote/validade/fornecedor | apoio decisão | estoque.views | `/api/estoque` | estoque_entradas | não | sim canon | estoque-ocr-canon | 🟡 | | Validade/parado na Intelligence |
| Estoque | Consumo estimado/real | não polícia | | trigger + estoque_consumo | não | sim | | 🟡 | estoque-consumo-real.sql | Unificar estimado/real |
| Estoque | Ligação procedimento | procedure_stock_usage | procedimentos.service | — | sim SQL procedimentos | não | | | 🟡 | | Usar no P&L |
| Estoque | OCR nota | entrada fácil | `#ocr` escondido | `/api/ocr` | ocr_nota_id | não | | OCR-CANON | 🟡 | | Custo Vision, PII |
| Estoque | sugestoes_estoque | | insert views | — | FALTA-NO-BANCO | não | ? | | 🟠 | | CREATE ou remover |
| Custos | Fixos mensais | lançar no financeiro | setup-inicial | — | financeiro categoria | não | | | 🟡 | | Rateio configurável |
| Custos | Motor completo | briefing | não | não | não | | | MOTOR 1.0 | 🔴 | | P1 após schema |
| Precificação | Cadastro + taxas + IA rascunho | não auto-preço | procedimento, precificacao-taxas, `/api/preco` | sim | procedures + org taxas | não | | PRECO-DESCONTO | 🟡 | | Explicar componentes |
| Precificação | Simuladores e se | briefing | parcial parcelas | | | | | | 🔵 | | P1/P2 |
| Margem risco | Produto +15% | | card financeiro/proc | audit | audit_logs | não | | REVISAO-POR-FATOR | 🟡 | **não lista procedimentos** | Completar impacto |
| Market Radar | faixa+fonte | | não | não | não | | | MARKET-RADAR | 🔵 | | P2 com fonte |
| Financeiro | Caixa DRE contas webhook | cruzar | financeiro.views | webhook | financeiro, contas_a_pagar | P0 RLS fin | sim | FINANCEIRO-CANONICO | 🟡 | | Ligar procedure_id+estoque |
| Financeiro | Metas | | master | — | financeiro_metas | não | master RPC | | 🟡 | | Ritmo P2 |
| Financeiro | Participação lucros | | service | — | participacao_lucros | não | | | 🟡 | | P2 |
| Financeiro | Import bancária | | importacao-bancaria | — | | | | | 🟡 | | |

---

## IA, CRM, marketing, portal

| Área | Feature | Visão | FE | API | Banco | Status | Fazer |
|------|---------|-------|----|-----|-------|--------|-------|
| IA Copilot | Chat explica | copilot-canon | `#copiloto` | `/api/copiloto` | copiloto_chat | 🟡 tela no centro | Contextual na ficha |
| IA | preco, marketing, protocolo, pele, estudo, discussão | vários | várias | várias | *_ia | 🟠 N copiloto | Um Intelligence |
| Intelligence | transversal | tese | não | não | não | 🔴 | P2 após custo/CRM |
| CRM | Inativos 90d | retenção | crm.views, cockpit | — | derivado agenda | 🟡 hardcoded | Ritmo pessoal |
| CRM | Segmentos VIP/pacote | | não | | packages existem | 🔵 | P1 |
| Marketing | Sugestões IA | | marketing.views | `/api/marketing` | marketing_ia | 🟡 sem custo/métrica | Intelligence marketing |
| Marketing | Calendário conteúdo | | calendario-conteudo | GET/POST api | conteudo_calendario | 🟡 | |
| WhatsApp | wa.me + Cloud | proximidade | whatsapp.service | `/api/whatsapp-send` | whatsapp_logs | 🟡 | Ligar CRM; opt-in |
| WhatsApp | templates | | modelos-mensagem | | message_templates | 🟡 | |
| Portal | Token jornada | Minha jornada | portal.html | RPC+create-session | client_sessions | 🟡 | Unificar telas |
| Portal | Agendar público | | agendar.html | RPC public | agenda | 🟡 | |
| Gamificação | XP clínica | | não | não | não | 🔵 P3 | Bloqueado |
| Estudo caso | 2–3 métricas | protocolo | `#estudo-caso` off menu | APIs | estudo_casos | 🟡 escondido | Recuperar na ficha |
| Push | | | push.service | | | 🟠 | Auditar depois P0 |
| Theme | | | theme.service | | | 🟢 | |
| Tutorial | | | tutorial.js | | | 🟡 | Ligar setup |

---

### Como ler “diferencial”

- **A** qualquer SaaS · **B** poucos · **C** diferencial SkinClinic · **D** efeito de rede entre módulos.

Itens **C** só valem se o grafo fechar. Isolados viram commodity.
