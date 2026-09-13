# OCR — Melhorias sugeridas (alinhadas ao cânon)

Comparação entre o que o **OCR-CANON-PROJETO-SUCESSO.md** define e o que está no código hoje.

---

## 1. Tela OCR isolada (#view-ocr) desalinhada com o cânon

**Cânon:** *"OCR na mesma tela do fluxo"* e *"Dentro do Estoque → Adicionar via OCR"*. OCR não é menu separado protagonista.

**Hoje:** Existe uma tela **OCR** no menu (upload + "Ler nota") que:
- Mostra só o **texto bruto** (`res.text`); não usa o **parsed** (produto, qtd, valor, fornecedor, data) que a API já retorna.
- Salva em `ocr_notas` (raw_text) e **não oferece** "conferir e salvar no estoque".
- Usa `user.id` e elementos globais (`btnLerNota`, `nota`, `resultadoOCR`) que podem não existir → risco de ReferenceError.

**Melhoria:**
- Usar **parsed** na view OCR: se a API retornar `parsed.itens`, exibir os campos sugeridos (conferir e salvar no estoque) na própria tela ou com botão "Salvar no estoque" (chamando `createEntrada` em loop), igual ao fluxo do Estoque.
- Ou: após ler, botão **"Abrir no Estoque para conferir e salvar"** que leva à tela Estoque com os dados em sessionStorage para abrir o modal de conferência.
- Garantir referências seguras (getElementById, checagem de `user`) para não quebrar.

**Impacto:** Tela OCR deixa de ser "lugar que só mostra texto" e vira **porta que reduz digitação e leva ao estoque**; alinhamento total com "OCR sugere, humano confirma, salva".

---

## 2. Incluir "lote" no parse e no fluxo de entrada

**Cânon:** *"Pode extrair: nome do produto, quantidade, valor, fornecedor, data, **lote (quando disponível)**."*

**Hoje:** A API pede ao GPT apenas `fornecedor`, `data`, `itens` (produto_nome, quantidade, valor_unitario, valor_total). A tabela `estoque_entradas` tem coluna `lote`; o modal "Entrada por OCR" no Estoque não tem campo lote.

**Melhoria:**
- No **api/ocr.js**: incluir no prompt do GPT `"lote": "string ou null"` por item (ou por nota, se for único).
- No **modal de conferência** (Estoque e, se existir, OCR): campo opcional **Lote** por item ou um único lote para a nota.

**Impacto:** Dados mais fiéis à nota; menos ajuste manual depois; cânon atendido.

---

## 3. Tela OCR: não depender de menu separado (opcional)

**Cânon:** *"OCR aparece onde faz sentido, não como menu separado."*

**Hoje:** O menu tem item **OCR** separado. O fluxo principal já está correto no **Estoque** ("Entrada por OCR").

**Melhoria (opcional):**
- Manter o item OCR no menu como **atalho** para quem quer só "ler uma nota" (e daí conferir/salvar no estoque), mas na própria tela OCR mostrar claramente: *"Os itens extraídos podem ser conferidos e salvos no Estoque abaixo."*
- Ou remover o item OCR do menu e deixar só "Estoque → Entrada por OCR" para forçar o fluxo único. Decisão de produto.

**Impacto:** Se remover: UX mais enxuta e 100% alinhada ao cânon. Se manter: atalho para power users, desde que a tela OCR já leve a "conferir e salvar no estoque".

---

## 4. Vincular entrada de estoque à nota OCR (ocr_nota_id)

**Cânon:** Histórico; "registra histórico"; estoque_entradas já tem `ocr_nota_id`.

**Hoje:** No Estoque, ao salvar itens do OCR, `createEntrada` não recebe `ocr_nota_id`. A tela OCR isolada grava em `ocr_notas` mas não retorna o id para vincular.

**Melhoria:**
- Ao salvar em `ocr_notas` (se mantiver), retornar o `id` da nota.
- Ao chamar `createEntrada` para itens vindos do OCR, passar `ocr_nota_id` quando existir (ex.: fluxo na tela OCR que primeiro grava ocr_nota, depois grava entradas com esse id).

**Impacto:** Rastreabilidade: qual entrada veio de qual nota lida; auditoria e suporte.

---

## 5. Tratamento quando o OCR não extrai itens

**Cânon:** *"Nenhum item extraído. Use o texto abaixo para entrada manual."* — já existe no Estoque.

**Hoje:** No Estoque, quando `!parsed?.itens?.length`, abre modal só com o texto. Poderia ter botão **"Fazer entrada manual com este contexto"** que abre o modal de entrada manual com o texto colado em um campo observação ou que preenche um único item "A conferir" para o usuário editar.

**Melhoria:** Botão no modal "Nenhum item extraído": **"Abrir entrada manual"** (fecha o modal e abre o de entrada manual), para não perder o contexto.

**Impacto:** Menos fricção; usuário não precisa ir em "Entrada manual" e lembrar do que estava na nota.

---

## Priorização sugerida

| Ordem | Melhoria                         | Esforço | Impacto                          | Status     |
|-------|----------------------------------|---------|----------------------------------|------------|
| 1     | Tela OCR: usar parsed + salvar no estoque + refs seguras | Médio   | Alto — tela OCR útil e sem erro  | **Feito**  |
| 2     | Lote no parse e no modal         | Baixo   | Médio — cânon e fidelidade       | **Feito**  |
| 3     | ocr_nota_id ao salvar entradas  | Baixo   | Rastreabilidade                  | Pendente   |
| 4     | Botão "Entrada manual" quando sem itens | Baixo   | UX                               | Pendente   |
| 5     | Menu OCR: manter como atalho ou remover | Produto | Consistência com cânon           | Decisão    |

Implementar na ordem 1 → 2 → 3 mantém o OCR coerente com o documento canônico e evita tela quebrada ou inútil.

---

## O que já foi implementado

- **Tela OCR (#view-ocr):** Reescrita com `getElementById` seguro; usa `parsed` da API; quando há itens, abre modal "Conferir e salvar no estoque" (mesmo fluxo do Estoque); salva em `ocr_notas` quando há texto; toast quando não há itens e indica usar Estoque → Entrada manual.
- **Lote:** Incluído no prompt da API (JSON com `lote` por item); campo Lote no modal de conferência (Estoque e OCR); `createEntrada` já aceitava `lote` e `ocr_nota_id`.
