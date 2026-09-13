# Ideias para melhorar a aba Procedimentos

Alinhado ao **PROCEDIMENTOS-IDEA.md** e à frase-guia: *"Procedimento não é só tempo e lucro — é custo real, operação e decisão consciente."*

---

## 1. Dados do procedimento

| Ideia | Por quê |
|-------|--------|
| **Código ou sigla** (ex.: LP-01) | Facilitar busca, relatórios e vínculo com agenda/ financeiro sem depender só do nome. |
| **Categoria** (ex.: Limpeza, Preenchimento, Laser) | Filtrar na agenda, nas métricas e nos relatórios por tipo de serviço. |
| **Margem mínima desejada** (%) | Base para a IA de precificação sugerir valor; decisão final sempre humana. |
| **Custo estimado de material** (por procedimento) | Entrada para precificação e para comparar “esperado vs. realizado” no estoque. |
| **Histórico de alteração de valor** | Ver quando e quanto mudou o preço; ajuda em revisão e metas. |

---

## 2. Precificação (IA apoia, não decide)

| Ideia | Por quê |
|-------|--------|
| **Bloco “Apoio à precificação”** na tela do procedimento | Mostrar: tempo, custo material, parcela de aluguel/luz (rateio), margem sugerida, **valor sugerido** e alerta se estiver abaixo da margem mínima. Tudo **sugestão**, com botão “Aplicar” (humano confirma). |
| **Simulador “E se…”** | Alterar tempo, custo de material ou margem e ver o impacto no valor sugerido, sem salvar automaticamente. |
| **Alerta de possível subprecificação** | Quando valor_cobrado estiver muito abaixo do custo estimado + margem mínima; apenas aviso, não bloqueia. |
| **Referências externas (opcional)** | Ex.: faixa de preço de mercado para o procedimento (fonte definida depois); só consulta, não define sozinho. |

---

## 3. Procedimento ↔ Estoque

| Ideia | Por quê |
|-------|--------|
| **Tela “Itens usados” por procedimento** | Listar e editar itens de `procedure_stock_usage` (item_ref + quantidade média); preparar para baixa estimada e conferência. |
| **Na conferência de estoque** | Mostrar “consumo esperado por procedimento” no período e “o que foi realizado” (quantidade de procedimentos × quantidade média por item); diferença para o usuário validar e corrigir. |
| **Baixa estimada ao marcar procedimento como realizado** | Na agenda ou em “atendimentos realizados”, opção de gerar **sugestão** de baixa no estoque; usuário confirma ou ajusta. Nunca baixa automática sem confirmação. |

---

## 4. Procedimento ↔ Finanças

| Ideia | Por quê |
|-------|--------|
| **Receita por procedimento** | No financeiro, ao registrar uma entrada, poder vincular a um **procedimento** (e opcionalmente ao atendimento/agenda). Assim “o que está entrando” fica por tipo de serviço. |
| **Quebra: custo operacional vs. pagamento funcionário** | No procedimento ou no financeiro: campos ou tags para classificar parte do valor como “custo operacional” e “pagamento funcionário”; assim o sistema pode mostrar lucro real por procedimento. |
| **Dashboard “Por procedimento”** | Gráfico ou tabela: receita, custo material estimado, margem real; base para metas plausíveis. |

---

## 5. Metas plausíveis (futuro)

| Ideia | Por quê |
|-------|--------|
| **Metas por procedimento** | Ex.: “X limpezas de pele no mês”; o sistema já sabe quantos foram feitos (agenda/realizados) e qual valor_cobrado; meta em quantidade e em receita. |
| **Metas por categoria** | Somar procedimentos da mesma categoria; metas realistas a partir do histórico. |
| **Comparativo realizado vs. meta** | Sempre informativo; metas definidas e revisadas pelo gestor. |

---

## 6. Agenda e operação

| Ideia | Por quê |
|-------|--------|
| **Seleção de procedimento no agendamento** | Em vez de só texto livre, escolher um procedimento do catálogo; duração e valor já vêm preenchidos; consistência com métricas e finanças. |
| **Ao marcar como realizado** | Registrar “procedimento X realizado na data Y”; gera dado para métricas, estoque (baixa estimada) e finanças (receita por procedimento). |

---

## 7. UX e clareza

| Ideia | Por quê |
|-------|--------|
| **Resumo no card do procedimento** | Além de nome/descrição/valor/duração: “Custo material est.: R$ X · Margem: Y%” (quando houver); um número de “vezes agendado no mês” ajuda o gestor. |
| **Filtros na lista** | Por categoria, ativo/inativo, “com valor preenchido” / “sem valor”; achar rápido o que revisar. |
| **Ordenação** | Por nome, valor, duração, mais usado; clareza sem complexidade. |
| **Inativar em vez de excluir** | Manter histórico em agenda e financeiro; só não aparecer em listas “ativas” para novo agendamento. |

---

## 8. Técnico / modelo de dados

| Ideia | Por quê |
|-------|--------|
| **Tabela de categorias de procedimento** | `procedure_categories` (org_id, name); procedure.category_id; evita texto solto e permite filtros e metas por categoria. |
| **Custo estimado no procedure** | Coluna `custo_material_estimado` (decimal); alimenta precificação e comparativo com realizado. |
| **Vínculo financeiro → procedimento** | Na tabela de lançamentos financeiros (ou equivalente), campo `procedure_id` opcional; relatórios “receita por procedimento”. |
| **Evento “procedimento realizado”** | Registrar em `client_events` ou em tabela de atendimentos (cliente, procedimento, data, profissional, valor); base para métricas, estoque e metas. |

---

## Priorização sugerida (exemplo)

1. **Curto prazo:** Código/sigla, categoria, custo estimado de material; seleção de procedimento na agenda; receita por procedimento no financeiro.
2. **Médio prazo:** Bloco “Apoio à precificação” (sugestão + alerta); tela “Itens usados” por procedimento; dashboard “Por procedimento”.
3. **Depois:** Simulador “E se…”, referências externas, metas por procedimento/categoria, baixa estimada ao marcar realizado.

---

*Estas ideias são sugestões de evolução dentro do conceito já definido no PROCEDIMENTOS-IDEA.md; a IA apoia, não decide, e nada é automático sem validação humana.*
