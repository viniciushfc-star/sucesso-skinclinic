# Equipe — Transcrição Canônica (Gestão, Pagamento e Auditoria)
## Projeto Sucesso

Equipe existe para **executar, sustentar e organizar** a clínica — não para ser exposta nem controlada indiscriminadamente.

---

## 1. Papel da Equipe para o Gestor

Para o gestor, equipe não é só agenda. Equipe também é **custo, acordo e responsabilidade**.

O sistema precisa permitir:

- Estruturar pagamentos
- Entender impacto financeiro
- Manter governança
- Proteger informações sensíveis

**Sem:** virar folha de pagamento, virar RH completo, expor dados indevidamente.

---

## 2. Modelos de Pagamento (Ideia Explícita)

O sistema deve comportar diferentes formas de pagamento da equipe:

- Salário fixo
- Porcentagem por procedimento
- Diária
- Combinações possíveis

**Importante:** O sistema **registra** o modelo e **usa para análise**. O sistema **não executa** pagamento.

---

## 3. Visibilidade Restrita (Crítico)

- Apenas cargos específicos podem ver valores (ex.: master).
- Mesmo esses cargos dependem de permissão do usuário master.
- Profissionais **não veem** pagamento de outros.
- Pagamento **não aparece** em telas operacionais comuns.

**Segurança por design, não por remendo.**

---

## 4. Equipe ↔ Agenda

Nem todo agendamento precisa ter profissional responsável.

Casos possíveis: evento interno, reunião, alinhamento remoto, bloqueio de agenda, afazeres operacionais.

**Agenda ≠ atendimento sempre.**

---

## 5. Regra Fundamental (Auditoria)

Mesmo quando não há profissional, cliente ou procedimento: **todo agendamento gera auditoria.**

---

## 6. Agendamento sem Profissional → Notificação

Se um agendamento não tem profissional associado, isso **vira notificação**.

- Objetivo: evitar erro no dia, esquecimento, “quem vai fazer isso?”.
- A notificação **não acusa**, **não bloqueia**, apenas **sinaliza**.
- Formato: “Esse item ainda não tem responsável definido.”

---

## 7. Afazeres (Derivado da Equipe)

**Afazer ≠ Agendamento.**

- Afazer: tem responsável, prazo, gera auditoria, pode gerar notificação.
- **Não** ocupa agenda de atendimento, **não** aparece como horário marcado.

Isso evita forçar tudo dentro da agenda.

---

## 8. Equipe ↔ Financeiro (Sem Expor)

O financeiro pode **usar** dados de pagamento para análise, impacto por procedimento, custo humano vs. margem.

**Mas:** não expõe valor em tela operacional, não mistura com agenda, não cria ranking entre pessoas.

---

## 9. Governança (Usuário Master)

O master:

- Controla permissões sensíveis
- Define quem vê pagamento
- Define quem altera modelo de pagamento
- Define quem acessa relatórios críticos

---

## 10. O que o Sistema NÃO Faz

- Não executa folha de pagamento
- Não faz transferência
- Não substitui contador nem jurídico
- Não expõe salário em agenda

---

## 11. Frases-Guia

- “Equipe é custo, mas também é responsabilidade.”
- “O sistema precisa saber quem faz — mas nem todo mundo precisa ver tudo.”
- “Se ninguém está responsável, o sistema avisa.”

---

## 12. O que Implementar a Mais (e Por quê)

| Implementação | Por quê |
|---------------|--------|
| **Modelo de pagamento por membro** (registro, só master) | O canon exige “registrar o modelo” e “usar para análise”; hoje não existe. Permite depois cruzar com procedimentos e financeiro sem expor em tela operacional. |
| **Profissional opcional na agenda** | “Nem todo agendamento precisa ter profissional” — hoje o campo é obrigatório; eventos internos, bloqueios e reuniões ficam travados. |
| **Notificação “sem responsável”** | “Se um agendamento não tem profissional, isso vira notificação” — evita erro no dia; não bloqueia, só sinaliza. |
| **Afazeres (tarefas com responsável e prazo)** | “Afazer ≠ Agendamento”; hoje tudo cai na agenda. Tarefas (estudo de caso, planejamento, orientação remota) não ocupam cabine; o sistema precisa reconhecer isso. |
| **Visibilidade de pagamento restrita** | Dados de pagamento só em área master (ou permissão explícita); nunca na lista geral da equipe. |

Implementar na ordem: (1) profissional opcional na agenda + notificação sem responsável; (2) modelo de pagamento (tabela + UI master); (3) afazeres (tabela + tela mínima).
