# Visão geral do app — SkinClinic / Projeto Sucesso

Documento para entender **como o app está hoje**: passos, ideias e onde cada coisa vive.  
Última atualização: janeiro 2025.

---

## 1. O que é o app

O sistema tem **duas frentes**:

| Frente | Quem usa | Onde entra |
|-------|----------|------------|
| **Dashboard (clínica)** | Equipe da clínica (admin, profissionais) | `dashboard.html` — login, depois navegação por telas (SPA). |
| **Portal do cliente** | Cliente final | `portal.html?token=...` — link único por sessão; sem login tradicional. |

- **Autenticação:** Supabase Auth; multi-organização (cada clínica é uma org).
- **Permissões:** por tela (ex.: `clientes:view`, `agenda:manage`, `financeiro:view`). Quem não tem permissão não vê o card/menu daquela área.
- **Dados:** Supabase (PostgreSQL); RLS por `org_id`.

---

## 2. Dashboard clínica — menu e telas

O menu lateral (sidebar) leva às seguintes **views** (telas):

| Menu / Botão | Rota (hash) | O que é |
|--------------|-------------|---------|
| Dashboard | `#dashboard` | Início: cards de métricas (clientes, agenda hoje, saldo) + bloco **Protocolos aplicados hoje** + gráficos. |
| Cadastrar → Clientes | `#clientes` | Lista de clientes; ao clicar em um, abre **Perfil do cliente** (modal/tela). |
| Cadastrar → Equipe | `#team` | Equipe, convites, procedimentos por profissional, afazeres. |
| Agenda | `#agenda` | Calendário mensal; ao clicar num dia, lista de agendamentos; ao clicar num agendamento, **painel lateral** (detalhe) com botões: Abrir perfil, **Registrar protocolo**, Editar. |
| Procedimentos | `#procedimento` | Cadastro de procedimentos e precificação. |
| Financeiro | `#financeiro` | Entradas/saídas, categorias, visão financeira. |
| Planos | `#planos` | Planos terapêuticos (conjunto de procedimentos + valores). |
| Cadastro da empresa | `#empresa` | Dados da clínica, salas, tipos de procedimento por sala. |
| Marketing → Sugestões | `#marketing` | Sugestões e métricas de marketing. |
| Marketing → Calendário | `#calendario-conteudo` | Calendário de conteúdo (posts, aprovação, agendamento). |
| Estoque | `#estoque` | Entradas (manual/OCR/XML), consumo estimado, resumo por produto (saldo = entradas − consumo). |
| Anamnese | `#anamnese` | Ficha de anamnese (pode abrir a partir do perfil do cliente ou da agenda). |
| Análises pele | `#analise-pele` | Lista das **análises de pele** enviadas pelo portal; validação e incorporação à anamnese. |
| Skincare | `#skincare` | Configuração/visão de skincare (ex.: protocolo atual). |
| Protocolo | `#protocolo` | Tela de **geração de protocolo (IA)** — conceito de “protocolo como método” (texto). O **registro do que foi aplicado** vive no **perfil do cliente** e no atalho da agenda. |
| Estudo de caso | `#estudo-caso` | Casos anonimizados por protocolo; perguntas pertinentes e esclarecer dúvida após leitura; agregação e frase de tendência. |
| OCR | `#ocr` | Leitura de notas fiscais para estoque. |
| Logs / Backup / Exportar / Master | respectivos | Auditoria, backup, exportação, painel master. |

**Perfil do cliente** (`#cliente-perfil`): aberto a partir de Clientes ou da Agenda. Contém:

- Abas: **Dados**, **Histórico / Linha do tempo**, **Protocolo**, **Rotina skincare**.
- **Protocolo:** formulário “Registrar o que foi aplicado” (select de protocolo + observação) + histórico de protocolos aplicados. Ao registrar, o estoque consome os descartáveis do protocolo; se algum estiver em falta/baixo, aparece **alerta** (toast), mas o registro **não é bloqueado**.
- **Rotina skincare:** texto da rotina; botão “Liberar no portal” para o cliente ver no portal.

---

## 3. Ideias e fluxos implementados

### 3.1 Análise de Pele por IA (pré-anamnese)

- **Portal:** Cliente envia fotos + respostas; a IA gera um texto preliminar. O cliente **não vê** o resultado da IA; vê só “Análise recebida, aguardando validação”.
- **Dashboard:** Em **Análises pele**, a clínica vê as análises pendentes, valida e pode incorporar o texto à anamnese. Só depois disso o cliente vê a devolutiva (texto validado) no portal.
- **Ideia:** pré-anamnese; a clínica mantém a palavra final.

### 3.2 Rotina de Skincare como acompanhamento

- **O que é:** Plano de cuidados (produtos, ordem, frequência) que a clínica define/valida e **libera** para o cliente ver no portal.
- **Dashboard:** No **perfil do cliente**, aba **Rotina skincare**: editar texto da rotina e botão **“Liberar no portal”** (grava `liberado_em`).
- **Portal:** Card **“Minha rotina de skincare”** só aparece se a rotina tiver sido liberada; ao clicar, o cliente vê o conteúdo.
- **Ideia:** Continuidade do cuidado + possibilidade de monetização (liberar por pacote/valor).

### 3.3 Protocolo — o que é feito dentro do procedimento

Conceito (resumo): **Plano** = conjunto de procedimentos + valores de venda. **Protocolo** = o que é feito *dentro* do procedimento (método + registro do que foi aplicado); **proteção da empresa** e entrada **rápida** para o profissional.

**Regras travadas (ver PROTOCOLO-IDEIA-AMADURECIDA.md):** (1) Discurso do botão Protocolo = **método + histórico + viabilidade**, nunca promoção. (2) Estudo de caso com **no máximo 2–3 métricas**; evitar BI confuso. (3) Desconto/parcelamento **sempre simulação**, nunca sugestão automática.

**Estudo de caso (implementado):** O **estudo de caso** (Camada 3) está implementado. Onde usar: (1) **Menu “Estudo de caso”** — selecionar protocolo, ver agregação (“Para perfis semelhantes, este protocolo teve melhora em N%…”), listar casos e, em cada caso, **fazer pergunta pertinente** (a IA responde e a pergunta/resposta fica salva) e **esclarecer dúvida após leitura** (informar artigo/tema + dúvida; a IA esclarece para aprender de verdade). (2) **Perfil do cliente → aba Protocolo** — bloco “Registrar para estudo de caso (anonimizado)” com tipo de pele, queixa, resposta observada (melhora/sem mudança/efeito adverso), nº sessões; usa o mesmo protocolo do select. (3) Na tela Estudo de caso há ainda **“Esclarecer dúvida após leitura”** (global): tema/artigo + dúvida, sem vínculo com caso. Tabelas: `estudo_casos`, `estudo_caso_perguntas`. SQL: `supabase-estudo-caso.sql`.

- **Cadastro:** Tabelas `protocolos` (template) e `protocolos_descartaveis` (produto_nome, quantidade por protocolo). No menu, a tela **Protocolo** é a de geração de texto por IA; o **registro do aplicado** não é nessa tela.
- **Onde vive o registro:**
  - **Aba Protocolo** no **perfil do cliente**: selecionar protocolo, observação, “Registrar o que foi aplicado”.
  - **Atalho na agenda:** No painel do agendamento, botão **“Registrar protocolo”** → abre o perfil do cliente já na aba Protocolo e, ao salvar, associa o `agenda_id` ao registro.
- **Estoque:** Ao registrar um protocolo aplicado, um trigger no banco insere em `estoque_consumo` os descartáveis daquele protocolo (quantidades definidas em `protocolos_descartaveis`). O estoque “assume” o consumo.
- **Alerta (não bloqueia):** Antes de gravar o protocolo aplicado, o sistema verifica se algum descartável do protocolo está com saldo menor que o necessário; se sim, mostra um toast de aviso (“estoque baixo ou zerado: produto X (precisa Y, saldo Z)”) e **mesmo assim** registra o protocolo.
- **Protocolos do dia:** No **Dashboard**, bloco **“Protocolos aplicados hoje”** lista hora, cliente e nome do protocolo para cada registro do dia.
- **Documento de ideia:** `PROTOCOLO-IDEIA-AMADURECIDA.md`.

### 3.4 Estoque

- **Entradas:** `estoque_entradas` (manual, OCR, XML); histórico de custo.
- **Consumo:** `estoque_consumo` (baixa estimada por procedimento ou por **protocolo aplicado**; tipo estimado/ajuste).
- **Saldo:** por produto = total entradas − total consumo (resumo em “resumo por produto”).
- **Referência:** “referência inteligente, não verdade absoluta”; divergência é informação, não punição.

---

## 4. Portal do cliente

- **Acesso:** `portal.html?token=...` (token de sessão gerado pela clínica; ex.: “Enviar link para completar cadastro” no perfil do cliente).
- **Rotas (hash após carregar):**
  - `#completar-cadastro` — se o cliente ainda não completou o cadastro.
  - `#dashboard` — início do portal (cards: análise de pele, rotina skincare se liberada, etc.).
  - `#analise-pele` — envio de análise de pele (fotos + perguntas); resultado só após validação da clínica.
  - `#skincare-rotina` — visualização da rotina de skincare (se liberada).
  - `#mensagens` — mensagens (se existir).
- **Fluxo típico:** Cliente recebe link → entra no portal → pode fazer análise de pele e ver rotina (se liberada); a clínica vê análises em “Análises pele” e rotinas no perfil do cliente.

---

## 5. Passos técnicos resumidos (onde está o quê)

| Ideia / recurso | Onde está no app | Observação |
|-----------------|-------------------|------------|
| Login / org | `dashboard.html`, `js/core/auth.js`, `js/core/org.js` | Multi-org; troca de org no header. |
| Navegação (SPA) | `js/core/spa.js` | Rotas por hash; permissão por rota. |
| Clientes e perfil | `js/views/clientes.views.js`, `js/views/cliente-perfil.views.js` | Perfil com abas Dados, Histórico, Protocolo, Rotina skincare. |
| Agenda | `js/views/agenda.views.js`, `js/services/appointments.service.js` | Painel lateral com “Abrir perfil” e “Registrar protocolo”. |
| Protocolo (registro + estoque + alerta) | `js/services/protocolo-db.service.js`, perfil (aba Protocolo), dashboard (bloco “Protocolos hoje”) | Trigger no Supabase consome descartáveis ao aplicar; alerta no front. |
| Estoque | `js/services/estoque-entradas.service.js`, `js/views/estoque.views.js` | Entradas, consumo, resumo por produto. |
| Análise de pele | `js/views/analise-pele.views.js`, `js/Client/analise-pele.client.js`, `api/analise-pele.js` | Portal envia; clínica valida; cliente vê só texto validado. |
| Rotina skincare | `js/services/skincare-rotina.service.js`, `js/Client/skincare-rotina.client.js`, perfil (aba Rotina skincare) | Clínica edita/libera; portal vê se liberado. |
| Anamnese | `js/views/anamnese.views.js`, `js/services/anamnesis.service.js` | Pode abrir do perfil ou da agenda (contexto do atendimento). |

---

## 6. Documentos e scripts de referência

- **Ideias / canon:**  
  `PROTOCOLO-IDEIA-AMADURECIDA.md`, `SKINCARE-ROTINA-IDEA.md`, `PROCEDIMENTOS-IDEA.md`, `PLANO-CANONICO.md`, `FINANCEIRO-CANONICO.md`, `EQUIPE-CANONICO.md`, `AGENDA-MODELO.md`, `DASHBOARD-PERMISSOES.md`, `ROUTES.md`, `CONFIG.md`, **`OCR-CANON-PROJETO-SUCESSO.md`** (transcrição canônica do OCR: papel, estoque, financeiro, precificação, UX, Copilot).
- **Regras Cursor (desenvolvimento):**  
  `.cursor/rules/` — ex.: `analise-pele-ia-canon.mdc`, `protocolo-canon.mdc`, `anamnese-canon.mdc`, `estoque-ocr-canon.mdc`, `marketing-copilot-canon.mdc`.
- **Supabase (SQL):**  
  Scripts em `supabase-*.sql` — ex. `supabase-protocolo-canon.sql`, `supabase-estoque-canon.sql`, `supabase-analise-pele-ia.sql`, `supabase-skincare-rotina.sql`, `supabase-anamnese-canon.sql`, `supabase-agenda-modelo.sql`, `supabase-rls-*.sql`. Ordem sugerida em `supabase-ordem-scripts.md`.

---

## 7. Próximos passos possíveis (ideias já discutidas)

- **Métricas de acurácia de estoque:** comparar previsão (protocolo) vs consumo real; meta ~85% acertiva.
- **Relatório de uso de protocolos:** por período, por cliente ou por protocolo.
- **Ajustes finos no texto** de `PROTOCOLO-IDEIA-AMADURECIDA.md` (tabela “As 3 dimensões”, “Próximo passo sugerido”) para alinhar 100% com o que está implementado.

Com este documento você tem um mapa dos passos e ideias do app hoje; para detalhes de negócio por tema, use os arquivos de ideia e canon listados na seção 6.
