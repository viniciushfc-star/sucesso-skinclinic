# SkinClinic — briefing para outro chat (o que temos, o que falta, como está de fato)

**Como usar:** copie este arquivo inteiro e cole no outro chat como contexto.  
**Data:** 2026-09-20  
**Repositório oficial:** `viniciushfc-star/sucesso-skinclinic`  
**Produção observada:** `https://skinclinic-one.vercel.app`  
**Regra:** isto é um **retrato baseado em evidência do código/SQL/docs**. Não inventar implementação. Não tratar o projeto como app vazio.

Auditorias longas (se o repo estiver no contexto):  
`docs/AUDITORIA-INTEGRAL-SKINCLINIC-2026.md`, `docs/MAPA-FUNCIONALIDADES-SKINCLINIC-2026.md`, `docs/MAPA-BANCO-SKINCLINIC-2026.md`, `docs/ROADMAP-IMPLEMENTACAO-2026.md`.

---

## 1. O que o produto DEVE ser (tese)

Não é “agenda + clientes + financeiro + estoque + um chat de IA”.

É o **sistema operacional da clínica de estética**:

```
CLÍNICA → DADOS → CONTEXTO → INTELIGÊNCIA → AÇÃO → RESULTADO → NOVOS DADOS → APRENDIZADO
```

Promessa externa: **“Da avaliação ao resultado, tudo conectado.”**  
Promessa interna: o sistema **entende a operação** e ajuda o gestor a decidir o próximo passo. A decisão continua **humana**.

IA: observa, cruza, calcula, explica, sugere, alerta, simula. **Não** manda, **não** altera preço sozinha, **não** diagnostica, **não** libera resultado clínico para o cliente sem validação profissional.

Cadeia que precisa conversar:

```
CLIENTE → AVALIAÇÃO → ANAMNESE → PLANO → PROCEDIMENTO
→ PROTOCOLO → PROTOCOLO APLICADO → ESTOQUE → CUSTO
→ MARGEM → EVOLUÇÃO → RETORNO → RELACIONAMENTO → RECOMPRA
```

Distinções travadas:

| Conceito | Significado |
|----------|-------------|
| **Plano** | O que foi combinado/vendido (resposta à dor + procedimentos) |
| **Protocolo** | Como executar |
| **Protocolo aplicado** | O que realmente aconteceu na sessão |
| **Atendimento** | Evento operacional (agenda) |
| **Evolução** | Resultado no tempo |

---

## 2. Como está DE FATO hoje (veredito)

- **Não é um CRUD vazio.** Há muita lógica, SQL, portal, IA, financeiro, estoque, anamnese, protocolo.
- **Também não é o OS inteligente.** Os **módulos existem**; o **grafo entre eles está incompleto**.
- O banco **não é reproduzível só pelas migrations oficiais** (~3 arquivos em `supabase/migrations/` vs ~88 SQL avulsos). O que está no Supabase live **não está 100% no Git**.
- **Não READY FOR PILOT** (faltam prova de RLS org A ≠ org B, schema único, E2E).
- **Não READY FOR PUBLIC LAUNCH.**
- Operação **fechada / piloto consciente** é possível, com risco de schema e isolamento.

Stack real: SPA HTML + ES modules + Express (`server.js` → Vercel `api/index.js`) + Supabase Auth/Postgres/RLS/Storage. CRUD no browser com JWT anon + RLS. Express para IA, WhatsApp, webhook, portal, Google Calendar, cron.

---

## 3. O QUE TEMOS (implementado — citar como existente)

Não é lista de marketing. É o que o código prova.

### Operação
- Login, cadastro, **multi-organização**, selecionar org, onboarding **mínimo** (nome da clínica).
- **Agenda** operacional (tabela `agenda`, grade no app). Célula vazia cria horário. Waitlist. Confirmação por token/portal. Lembrete (manual + cron se env configurado). Google Calendar (OAuth, blocos).
- **Clientes** (`clients`) + perfil com várias abas. CPF para evitar duplicado. Pacotes de sessão (`client_packages`).
- **Anamnese** modular no SPA + preenchimento pelo cliente no portal.
- **Análise de pele:** IA preliminar **interna**; profissional valida; portal **não** deve ver preliminar.
- **Planos terapêuticos** (`planos_terapeuticos`) — existe; pouco costurado na jornada.
- **Procedimentos** com preço, duração, custo material **estimado**, margem mínima, comissão %, vínculo com itens de estoque (`procedure_stock_usage`).
- **Protocolo** (método) + **protocolo aplicado** + trigger SQL de **consumo de estoque** ao aplicar (`estoque_consumo_ao_aplicar_protocolo`).
- **Skincare:** rascunho de IA → profissional libera.
- **Fotos de evolução** (antes/depois).
- **Estudo de caso** (código existe; **saiu do menu raiz** — não está perdido).
- **OCR** de nota → estoque (rota `#ocr` existe; **não está no menu raiz**).

### Dinheiro e estoque
- Financeiro: entradas/saídas, DRE, contas a pagar → saída, taxas da maquininha, parcelamento, `procedure_id`, importação, webhook de transações (idempotência se coluna existir).
- **Custos fixos:** checklist que **cria lançamentos** no financeiro (`setup-inicial.views.js`) — **não** é rateio profissional por hora/atendimento.
- **Estoque:** entradas (lote, fornecedor, custo), consumo estimado/real, saldo = entradas − consumo. **Não trava** atendimento (canônico).
- **Margem em risco (embrião):** se o custo do produto sobe ≥15%, grava `audit_logs` (`estoque.custo_aumentou`) e mostra card no financeiro/procedimentos. **Ainda não lista procedimentos afetados nem margem antes/depois.**
- **Metas:** tabela `financeiro_metas` (UI master) — **não** é sistema de ritmo/previsão.
- Flags **desligadas de propósito:** `PAGAMENTO_APP_ENABLED = false`, `CONTABILIDADE_INTERNA_ENABLED = false`. Não ligar.

### Relacionamento e IA
- CRM: inativos derivados da agenda (cockpit usa **90 dias**), waitlist, fidelidade por visitas, brinde aniversário (org).
- Marketing: sugestões IA + calendário de conteúdo — **não** é marketing intelligence com objetivo/custo/métrica.
- WhatsApp: `wa.me` padrão; Cloud API se houver token; templates; logs.
- Copiloto + várias APIs (`/api/preco`, `/api/marketing`, `/api/protocolo`, pele, skincare, estudo de caso, OCR, estoque). Vários “copilotos”, **não** uma Intelligence.
- **Dashboard cockpit** (2026): Hoje / Atenção / Oportunidades (“o que olhar agora”). Ainda compete com cards globais de contagem.

### Portal, segurança, importação
- Portal do cliente com token. Código novo: **hash + TTL 7 dias** (migration `20260920120000`). Sessões antigas em texto claro podem existir até expirar.
- Agenda pública `agendar.html`.
- Convites: `organization_invites` + API de e-mail. **Há legado** (`inviteUser` → Edge `dynamic-api` / tabela `convites`) — não tratar como fonte de verdade.
- Permissões: roles `master` / `gestor` / `staff`→`funcionario` + overrides `organization_user_permissions`. **Se a tabela de permissões não existir, a API cai na role (fail-open).** O briefing de produto pede fail-closed em produção — **conflito registrado, ainda não resolvido no código.**
- Importação **CSV** (até 2000 linhas): clientes, procedimentos, financeiro, custo fixo, agenda — `importacao-lote.service.js`, tela `#export`. **Não** é migração com IA / mapa de colunas / rollback.
- Backup/export existem; restore em massa é **perigoso**.
- PWA network-first (após correção de cache).
- Testes: `npm test` + catálogo QA HTTP. **Isso não prova isolamento multi-tenant.**

---

## 4. O QUE FALTA (e o tipo de falta)

Legenda para o outro chat:

- **CÓDIGO** = existe implementação  
- **SQL AVULSO** = existe script, pode não estar no projeto live  
- **MIGRATION OFICIAL** = está em `supabase/migrations/`  
- **DOC/IDEIA** = escrito, não construído  
- **PARCIAL** = existe pedaço, não fecha o ciclo  
- **LEGADO/DUPLICADO** = duas verdades  
- **AUSENTE** = não há no repo de forma utilizável  

### Crítico (P0) — bloqueia verdade e segurança
- Banco como fonte única (dump live + CREATE nas migrations).
- Prova **Org A não lê Org B** (tabelas, Storage, RPC, export).
- Unificar **`agenda` vs `appointments`** (grade usa `agenda`; trechos de `appointments.service.js` escrevem `appointments` — tabela sem CREATE claro no repo).
- Unificar **`clients` vs fallback `clientes`**.
- Fail-closed de permissões em produção.
- Convite único (acabar com Edge legado).
- RLS de `profiles` no SQL base é permissiva (`USING (true)`).
- E2E real (login → org → agenda → cliente → portal).

### Essencial para deixar de ser genérico (P1)
- Custo **real** do procedimento (lote + consumo + mão de obra + taxa + rateio de fixo **com método visível**).
- Precificação com **preço mínimo / equilíbrio / recomendado / lucro/hora** e texto “por que”, **sem** mudar o preço.
- Margem em risco **por procedimento** (hoje só “produto subiu”).
- Protocolo aplicado no **atalho da agenda** como caminho principal (canônico); menu Protocolo hoje parece “IA de texto”.
- Cockpit sem duplicar cards; onboarding **setup progress** (não só nome da org).
- Radar de retorno (ritmo da paciente, pacote incompleto, nova sem 2º atendimento) — sem disparo automático.
- CSV com prévia/relatório; portal como **Minha jornada**.

### Diferencial depois (P2)
- **SkinClinic Intelligence** (uma camada, sem spam) — **AUSENTE**.
- Metas com ritmo e previsão — **PARCIAL** (`financeiro_metas`).
- Market Radar com fonte/data/região — **AUSENTE** (não inventar números).
- Marketing intelligence estruturado.

### Futuro (P3) — não começar com P0/P1 aberto
- Gamificação / “Evolução da Clínica” (XP) — **AUSENTE**.
- Pagamento no app, contabilidade interna, NFS-e, multiunidade (`unit_id`), app stores.

**Não existe hoje:** Market Radar, Intelligence transversal, XP, filial dentro da org, motor completo de custo, setup %.

---

## 5. Duplicidades e conflitos (não escolher em silêncio)

1. **`agenda` (canônico operacional) vs `appointments` (legado no service).**  
2. **`clients` vs `clientes`.**  
3. **`organization_invites` vs `convites` / Edge `dynamic-api`.**  
4. **`audit_logs` vs `logs` (deprecated).**  
5. Catálogo de permissão ausente: código **fail-open na role** vs briefing **fail-closed**.  
6. Papéis atuais vs MASTER / GESTOR / PROFISSIONAL / RECEPÇÃO / VIEWER.  
7. Copilot canônico (“só dados internos”) vs Market Radar (externo) — módulos **separados**.  
8. Docs `APP-VISAO-GERAL.md` (jan/2025, calendário mensal) e `FALTA-NO-BANCO.md` **desatualizados** em trechos.  
9. Canônico: Protocolo vive na **ficha + atalho da agenda**, não como “promoção” nem só tela de IA.

Fonte de verdade de produto: `.cursor/rules/*-canon.mdc` + `docs/PLANO-CANONICO.md` + `docs/PROTOCOLO-IDEIA-AMADURECIDA.md` + `docs/FINANCEIRO-CANONICO.md`.

---

## 6. O ciclo que ainda NÃO fecha (coração do produto)

O desejado:

```
Cliente fez procedimento
→ estoque consumido
→ custo calculado
→ margem atualizada
→ financeiro recebeu
→ CRM atualizou jornada
→ retorno previsto
→ meta atualizada
→ Intelligence percebeu
→ marketing (opt-in) pode agir
```

**Hoje:** aplicado **pode** baixar estoque (se trigger estiver no live). Custo do lote **não** vira P&L claro do procedimento. Margem em risco **não** aponta o procedimento. Financeiro **pode** ter `procedure_id` mas não é o OS. CRM é “90 dias”. Meta é número solto. Intelligence não existe.

Por isso o app **ainda parece** SaaS genérico se a pessoa só olhar o menu.

---

## 7. O que recuperar (já existe, está escondido ou fraco)

- Importação CSV (estratégica para onboarding).  
- Margem em risco de produto (completar, não recriar).  
- Taxas reais da maquininha + simulador.  
- Plano terapêutico.  
- Protocolo aplicado + consumo.  
- Estudo de caso e OCR (fora do menu raiz).  
- Pacotes, waitlist, inativos, cockpit.  
- Custo fixo checklist (evoluir para rateio, não segundo módulo).

---

## 8. Regras absolutas para quem for implementar

- **Não** sair criando features P2/P3.  
- **Não** quebrar o que já opera.  
- **Não** duplicar financeiro, estoque, copiloto, agenda.  
- **Não** usar frontend como segurança.  
- **Não** `PAGAMENTO_APP_ENABLED = true`.  
- **Não** service role no frontend.  
- **Não** expor `ia_preliminar` no portal.  
- **Não** alterar preço automaticamente.  
- **Não** WhatsApp em massa sem opt-in.  
- **Não** dados de mercado inventados.  
- Se documentação conflitar: registrar o conflito; canônico = regras `*-canon` + docs canônicos acima.  
- Próxima implementação correta: **Fase 0 — schema único / dump do banco**, depois isolamento, depois ligar custo↔procedimento.

---

## 9. Prioridade resumida

| | Foco |
|--|------|
| **P0** | Verdade do banco + isolamento + unificar duplicatas + permissões + E2E |
| **P1** | Grafo custo/margem + jornada (ficha/agenda) + setup/CSV + radar de retorno |
| **P2** | Intelligence, metas de verdade, portal jornada, radar de mercado com fonte |
| **P3** | XP, pagamento, fiscal, filiais |

---

## 10. Frase única para alinhar o outro chat

> O SkinClinic **já tem** clínica, agenda, ficha, protocolo, estoque, caixa e IAs.  
> O que **falta** não é “mais um módulo”: é **uma única verdade no banco**, **isolamento provado**, e **os módulos se falarem** para o gestor ver custo real, margem em risco, quem deveria voltar e o que fazer hoje.  
> Enquanto isso não fechar, o produto **parece** agenda+financeiro+IA — e isso é copiável.
