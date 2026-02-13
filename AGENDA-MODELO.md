# Modelo da agenda — plano técnico

Frase-guia: **“A agenda organiza o tempo, protege a privacidade e prepara o atendimento — quem decide é o profissional.”**

---

## 1. Separação obrigatória: tipos de item

| Tipo            | Cliente | Profissional | Procedimento válido | Uso |
|-----------------|--------|--------------|----------------------|-----|
| **procedure**   | Sim    | Sim          | Sim (catálogo)       | Atendimento ao cliente |
| **event**       | Não    | Sim (opcional) | Não                | Reunião, bloqueio, treinamento |

- Procedimento ≠ evento: ambos ocupam tempo; só procedimento envolve cliente.
- A agenda **não** é um CRUD solto: orquestra **cliente + profissional + procedimento/evento + contexto**.

---

## 2. Visões

| Visão          | Objetivo        | Ação principal |
|----------------|-----------------|----------------|
| **Mensal**     | Planejamento, ocupação, gargalos | Clique no dia → abre agenda do dia |
| **Do dia**     | Operação        | Por horário: livre/ocupado, tipo, profissional; clique em ocupado → painel lateral (nunca navega direto) |

---

## 3. Criação de agendamento (fluxo no script)

### Passo 1 — Escolher tipo
- **Procedimento** → obrigatório: cliente, procedimento (catálogo), profissional, duração, sala/cabine (se houver).
- **Evento interno** → título, profissionais envolvidos, duração, tipo (reunião, bloqueio, treinamento, outro).

### Regras
- Só procedimentos cadastrados na org.
- Profissional precisa estar habilitado.
- Horário precisa estar disponível (respeitando blocos externos, se houver).

---

## 4. Integração Google Agenda (profissional liberal)

- **Não fazer:** ler detalhes da agenda pessoal; mostrar compromissos externos; sincronizar tudo.
- **Fazer:** sistema só sabe **indisponível / disponível**, com margem.
  - Ex.: ocupado 10h–11h no Google → sistema marca indisponível até 11h30, livre a partir de 11h30.
- Tabela sugerida: `external_calendar_blocks` (apenas `user_id`, `start_at`, `end_at` — sem título/descrição).

---

## 5. Clique no horário ocupado → ficha do cliente

- Abre **painel lateral** (ou modal), **não** navega para outra página.
- Mostra: nome do cliente, procedimento, histórico recente, alertas, botão **“Abrir perfil completo”**.
- Regra: **visualização ≠ edição**; agenda prepara, não resolve.

---

## 6. O que implementar no script (resumo)

| Camada        | Implementação |
|---------------|----------------|
| **Schema**    | `agenda`: `item_type` (procedure \| event), `professional_id`, `procedure_id` (FK), `duration_minutes`, `event_title`, `event_type`; tabela `procedures`; `professional_availability`; `external_calendar_blocks`. |
| **Service**   | `appointments.service.js`: criar/editar por tipo; listar por dia/mês; respeitar blocos externos. |
| **Views**     | `CalendarView` (month / day); ao clicar em slot ocupado → painel lateral com resumo do cliente + “Abrir perfil completo”. |
| **AgendaItem**| `type`, `professional_id`, `start_time`/`end_time` (ou `data`+`hora`+`duration`), `status`. |

---

## 7. Migração do que já existe

- Registros atuais da tabela `agenda` (com `cliente_id`, `procedimento`, `user_id`) → tratar como `item_type = 'procedure'`.
- `user_id` existente → mapear para `professional_id`.
- Campo livre `procedimento` → migrar gradualmente para `procedure_id` (catálogo) ou manter como texto até criar o catálogo.

O script SQL `supabase-agenda-modelo.sql` adiciona colunas e tabelas de forma **aditiva** para não quebrar o que já está em produção.
