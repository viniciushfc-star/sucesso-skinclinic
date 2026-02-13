# Financeiro — Transcrição Canônica (versão refinada)
## Projeto Sucesso

O Financeiro não cria dados: ele cruza, explica e projeta.

---

## 1. O que o Financeiro realmente é

O Financeiro é o **núcleo de consolidação e inteligência** do sistema. Ele:

- Recebe dados de outros módulos
- Cruza esses dados
- Transforma dados operacionais em números reais
- Explica esses números de forma plausível
- Apoia decisões estratégicas

**Princípio central:** Cada módulo faz sua parte. O Financeiro conecta tudo.

---

## 2. O que o Financeiro NÃO faz (limites claros)

- Não vira gargalo operacional
- Não exige input duplicado
- Não toma decisão automática
- Não altera preços (precificação mora em Procedimentos)
- Não substitui gestor ou contador

---

## 3. De onde vêm os dados

| Fonte | O que alimenta o Financeiro |
|-------|-----------------------------|
| **Procedimentos** | Valor cobrado, custo material estimado, margem (por procedimento) |
| **Agenda (realizados)** | Quantidade por procedimento, ocupação (futuro) |
| **Estoque** | Consumo real, custo de insumos ao longo do tempo (futuro) |
| **Tabela financeiro** | Entradas/saídas manuais (aluguel, salários, etc.) e entradas vinculadas a procedimento (`procedure_id`) |

**Transações manuais:** Existem para o que não vem de outros módulos. Quando a transação é **receita por serviço**, vincule ao procedimento — o Financeiro cruza com Procedimentos (receita por procedimento, custo estimado, margem).

---

## 4. O que o usuário vê (saídas)

- **Resumo:** Total de entradas, total de saídas, saldo
- **Lista de transações:** Com descrição, tipo, valor, data e procedimento (quando vinculado)
- **Por procedimento:** Receita (soma das entradas vinculadas), custo estimado (do cadastro do procedimento), margem — para comparar procedimentos e ver rentabilidade
- **Alertas/sinalizações (futuro):** Ex.: procedimento com muita saída e margem baixa
- **Simulações (futuro):** Ex.: “Se subir 10% no procedimento X, o impacto provável é este”

---

## 5. Relação Financeiro ↔ Procedimentos (precificação)

- A **precificação NÃO mora no Financeiro.** Ela mora em **Procedimentos.**
- O Financeiro **recebe** os dados da precificação (valor, custo, margem) e usa para:
  - Comparar procedimentos entre si
  - Medir rentabilidade real
  - Simular impacto de mudanças
  - Detectar procedimentos que “dão volume mas não dão lucro”

---

## 6. Metas financeiras (como se constroem)

Metas **plausíveis**, não motivacionais vazias. O Financeiro cruza:

- Capacidade da agenda
- Tempo por procedimento
- Margem real
- Consumo de estoque (futuro)
- Disponibilidade do time

**Como:** Metas por procedimento ou por categoria, com base em histórico de realizados (agenda) + valor cobrado (procedimentos) + custo real (estoque). IA sugere; gestor confirma.

---

## 7. Papel da IA no Financeiro

A IA **não decide**. Ela ajuda a:

- Encontrar correlações
- Explicar números
- Simular cenários
- Mostrar consequências

Exemplo: *“Esse procedimento tem alta saída, mas margem menor”* / *“Esse aumento de custo impacta mais X do que Y”*.

---

## 8. Frases-guia

- **“Financeiro não cria números. Ele revela relações.”**
- **“Preço sem custo e margem é chute.”**
- **“Trabalhar menos começa por entender melhor.”**

---

## 9. Glossário rápido

| Termo | Significado |
|-------|-------------|
| **Margem** | (Receita − Custo) ÷ Receita (ou similar). Quanto sobra por unidade de receita. |
| **Custo real vs. estimado** | Estimado = definido no cadastro do procedimento (custo material). Real = medido depois (estoque, etc.). |
| **Receita por procedimento** | Soma das entradas no financeiro vinculadas a um procedimento (`procedure_id`). |

---

*Conteúdo alinhado com Agenda, Procedimentos, Estoque e IA de apoio. Nada foi inventado; apenas organizado como sistema.*
