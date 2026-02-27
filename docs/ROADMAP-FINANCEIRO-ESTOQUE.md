# Roadmap: Financeiro, Estoque e Custos

Ideias para um sistema **revolucionário**: que traga lucro para a clínica e ajude as pessoas com dados claros e acionáveis.

---

## Já implementado (esta sessão)

### Financeiro
- **A receber (agendamentos)**: card na Visão geral com o valor previsto dos próximos 30 dias com base nos agendamentos (procedimentos com valor; retornos excluídos). Assim você vê “quanto vai entrar” além do que já entrou.
- **O que mais traz lucro**: ranking por margem em R$ (receita − custo estimado de material). Mostra quais procedimentos mais “bancam” a clínica. Tabela “Por procedimento” ganhou coluna **Margem R$** e **Margem %**.

### Estoque
- **Data de validade**: coluna opcional `data_validade` em `estoque_entradas` (migration `supabase-estoque-validade.sql`). Entrada manual permite informar validade.
- **Próximo a vencer**: bloco na view Estoque listando produtos que vencem nos próximos 60 dias, com **procedimentos que usam** cada produto — base para campanhas (“produto X vence em breve → promova o procedimento Y que usa X”).
- Serviços: `getProdutosProximosVencer(dias)`, `getProcedimentosQueUsamProduto(produtoNome)` (match por `procedure_stock_usage.item_ref`).

---

## Próximos passos sugeridos

### 1. Procedimento: material usado e custo real
- **Hoje**: `procedure_stock_usage` (procedure_id, item_ref, quantity_used) e `custo_material_estimado` em `procedures`.
- **Evolução**: 
  - Na tela do procedimento, listar “materiais usados” (a partir de `procedure_stock_usage`) e permitir editar.
  - **Custo real calculado**: para cada procedimento, somar `quantity_used × preço_atual_do_produto`. Preço atual pode ser o último `valor_unitario` de `estoque_entradas` por produto (ou custo médio do resumo). Exibir “Custo estimado” vs “Custo real (calculado)” para refinar precificação.

### 2. Custos fixos variáveis (água, luz, etc.)
- **Ideia**: custos como luz e água sobem com o volume de atendimentos. Modelar como:
  - **Custo fixo base** (ex.: R$ 500/mês) + **por atendimento** (ex.: R$ 2 por atendimento), ou
  - **Faixas**: até N atendimentos = valor X; acima = valor Y.
- **Onde**: na área de Custo fixo (setup-inicial / tabela de custos), permitir marcar um custo como “variável” e informar:
  - valor base mensal;
  - valor por atendimento (ou faixas).
- **Uso**: no fluxo de caixa e no “quanto cada procedimento precisa cobrir”, considerar o custo fixo rateado por atendimento (ex.: 200 atendimentos no mês → R$ 2 × 200 a mais de “luz”).

### 3. Mais métricas e pesquisa no Financeiro
- Filtros por período (já existe em parte), tipo (entrada/saída), categoria e busca por descrição.
- Exportar relatório “previsto vs realizado” (agendamentos vs entradas efetivas).
- Gráfico “entradas realizadas vs previsto do mês” (linha do tempo).

### 4. Campanhas a partir do estoque
- Na lista “Próximo a vencer”, botão “Sugerir campanha”: abrir Marketing ou Calendário de conteúdo com sugestão de texto (ex.: “Produto X em uso no procedimento Y — agende antes de [data]”).
- Integração opcional com modelos de mensagem (aniversário, lembrete) para incluir sugestões de procedimento com base em produtos próximos a vencer.

---

## Visão de produto

- **Para a clínica**: saber quanto vai entrar, o que mais traz lucro, o que está próximo a vencer e em quais procedimentos usar, com custo real e custos fixos bem estipulados.
- **Para o mercado**: um sistema que une agenda, financeiro, estoque e precificação de forma clara, ajudando a tomar decisões e a reduzir desperdício (validade) e a precificar com margem real (custo material + custo fixo rateado).

Execute a migration `supabase-estoque-validade.sql` no Supabase para ativar o campo de validade nas entradas de estoque.
