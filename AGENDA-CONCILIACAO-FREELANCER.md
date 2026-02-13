# Conciliação da agenda com a agenda do funcionário freelancer

Resposta direta: **a agenda já considera** os horários em que o profissional está ocupado em outro lugar (ex.: agenda pessoal/Google), mas **hoje não existe** a integração que **preenche** esses horários automaticamente a partir do Google (ou de outro calendário). Ou seja: a **conciliação está preparada no modelo e na lógica**; falta a **conexão com a agenda externa** e a **interface** para o freelancer conectar.

---

## O que já existe hoje

### 1. Tabela `external_calendar_blocks`

- **Onde:** Supabase (`supabase-agenda-modelo.sql`).
- **Campos:** `org_id`, `user_id`, `start_at`, `end_at` (sem título/descrição, para privacidade).
- **Uso:** Guardar blocos de tempo em que o profissional está **indisponível** porque tem compromisso em outro calendário (ex.: Google).

### 2. Lógica na agenda

- **`getAvailableProfessionals(date, time, durationMinutes, procedureId)`**  
  Retorna quem está **disponível** naquele slot. Considera:
  - agendamentos já existentes na agenda da clínica;
  - **blocos em `external_calendar_blocks`** (sobreposição com o slot).
  Quem tiver bloco externo no horário **não** entra na lista de disponíveis.

- **`checkProfessionalAvailable(professionalId, date, time, durationMinutes)`**  
  Usa a lista acima; se o profissional não estiver nela, retorna indisponível.

- Na checagem de **sala/profissional**, quando há conflito com bloco externo, o sistema devolve algo como: *"Compromisso externo (Google, etc.)"* — ou seja, a agenda **já trata** esse tipo de conflito.

### 3. Documentação e UI

- **AGENDA-MODELO.md:** descreve a integração Google (profissional liberal): sistema só sabe **indisponível/disponível**, com margem (ex.: ocupado 10h–11h no Google → indisponível até 11h30).
- **Equipe (dashboard):** texto informativo: *"Integração Google Agenda: ao cadastrar o funcionário… você poderá conectar a agenda Google dele. A disponibilidade dele aparecerá automaticamente ao criar um agendamento."*

Conclusão: **sim, a agenda tem a questão de conciliação com a agenda do freelancer** no sentido de que o **modelo e a regra de disponibilidade já consideram** compromissos externos. O que falta é **como** esses compromissos entram na tabela.

---

## O que ainda não existe (para fechar a conciliação)

| Item | Situação | O que seria necessário |
|------|----------|-------------------------|
| **Sync com Google Calendar** | Não implementado | OAuth do Google + Google Calendar API: ler “busy” do calendário do profissional (ou de uma agenda específica) e gravar/atualizar linhas em `external_calendar_blocks` (com margem, ex.: +30 min após o fim do evento). Pode ser um job periódico (ex.: a cada 15 min) ou ao abrir a tela de agendamento. |
| **UI “Conectar Google Agenda”** | Não implementado | Na tela Equipe, por profissional: botão “Conectar Google Agenda” que inicia o fluxo OAuth; após autorização, o sistema (ou um backend) passa a sincronizar os blocos daquele usuário. |
| **Bloqueio manual “indisponível”** | Não implementado | Opcional: tela ou modal para o profissional (ou admin) marcar “indisponível” em um intervalo (data/hora início e fim); gravar em `external_calendar_blocks`. Assim a conciliação funciona mesmo sem Google. |

Nenhum desses itens altera a regra de negócio: a agenda **já respeita** o que estiver em `external_calendar_blocks`; falta apenas **popular** essa tabela (por sync Google ou por bloqueio manual).

---

## Resumo

| Pergunta | Resposta |
|----------|----------|
| **A agenda tem conciliação com a agenda do funcionário freelancer?** | **Sim, em termos de modelo e lógica:** a tabela `external_calendar_blocks` existe e a disponibilidade do profissional (e a checagem de conflito) já consideram esses blocos. Ao agendar, quem está “ocupado” no calendário externo não aparece como disponível. |
| **Está tudo pronto para usar?** | **Não.** Falta: (1) integração com a API do Google (ou outro calendário) para preencher automaticamente os blocos do freelancer; (2) UI para “Conectar Google Agenda” por profissional; e, opcionalmente, (3) tela de bloqueio manual “indisponível” que também grave em `external_calendar_blocks`. |

Ou seja: a **conciliação está desenhada e já é usada na hora de ver disponibilidade**; o próximo passo é implementar a **fonte** dos dados (Google sync e/ou bloqueio manual) e a **interface** para o freelancer (ou admin) conectar a agenda.
