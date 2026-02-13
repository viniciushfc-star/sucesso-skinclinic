# Revisão por fator — implementações

Revisão de cada funcionalidade implementada, com ajustes feitos onde necessário.

---

## 1. Card “Margem em risco” (Financeiro + Procedimentos)

**O que foi revisado**
- `audit.service.js`: `getMargemEmRisco(30)` busca `audit_logs` com `action = 'estoque.custo_aumentou'` e retorna lista com `produto_nome`, `variacao_percentual`, etc.
- Financeiro e Procedimentos: `renderCardMargemRisco(containerId)` é chamado no início do render; o card só aparece quando há itens.
- Link “Ver na Auditoria” usa `href="#auditoria"`.

**Ajuste**
- O SPA não reagia a cliques em links `#auditoria` (apenas a `popstate`). Foi adicionado listener `hashchange` em `spa.js` para que qualquer link `href="#view"` chame `navigate(view)` e troque de tela corretamente.

**Arquivos**
- `js/services/audit.service.js`
- `js/views/financeiro.views.js`, `js/views/procedimento.views.js`
- `dashboard.html` (containers `financeiroCardMargemRisco`, `procedimentoCardMargemRisco`)
- `js/css/style.css` (`.card-margem-risco`)

---

## 2. Unificação logs / audit

**O que foi revisado**
- `logs.service.js`: marcado como `@deprecated`, sem outros usos de `logAction` no projeto.
- Uso de auditoria concentrado em `audit.service.js`.

**Nenhum ajuste necessário.**

---

## 3. Permissões auditoria (auditoria:view / auditoria:acknowledge)

**O que foi revisado**
- `permissions.map.js`: gestor tem `auditoria:view` e `auditoria:acknowledge`.
- `spa.js`: rota `auditoria` usa `permission: "auditoria:view"`.
- `logs.views.js`: checagem com `auditoria:view` e `auditoria:acknowledge`.
- `permissions.js`: ao checar `auditoria:view` ou `auditoria:acknowledge`, é considerado também override de `logs:view` / `logs:acknowledge` para não quebrar permissões antigas.

**Nenhum ajuste necessário.**

---

## 4. Erro amigável na Auditoria (RLS / tabela)

**O que foi revisado**
- Em erro 400/403 ou mensagem com PGRST/RLS/permission/policy, a tela mostra texto orientando a rodar os scripts SQL no Supabase.

**Ajustes**
- No `catch` de `renderLogs`: estado da paginação é resetado (`allRows`, `offset`, `hasMore`) e o bloco “Carregar mais” é escondido, para que, após corrigir o Supabase, a tela recarregue limpa.

**Arquivo**
- `js/views/logs.views.js`

---

## 5. Loading na troca de view

**O que foi revisado**
- Overlay com spinner em `#viewLoadingOverlay` no `mainContent`.
- `renderRoute` em `spa.js` mostra o overlay antes de `carregarView` e esconde no `finally`.
- CSS e animação do spinner.

**Nenhum ajuste necessário.**

---

## 6. Exportar auditoria em CSV

**O que foi revisado**
- Botão “Exportar CSV” na toolbar da Auditoria.
- Usa `auditLogsState.allRows` com o filtro de “pendentes” aplicado; cabeçalhos e `escapeCsv` para campos com `;`, `"` ou quebra de linha; BOM UTF-8 e download com data no nome.

**Nenhum ajuste necessário.**

---

## 7. Paginação / Carregar mais na Auditoria

**O que foi revisado**
- Primeira carga: `range(0, 29)`; “Carregar mais” define `offset = allRows.length` e chama `renderLogs` de novo.
- Filtro “Pendentes” aplicado em cima de `allRows` após buscar a página.
- Ao mudar período/tipo/status, estado é resetado e a lista é recarregada do zero.

**Nenhum ajuste necessário** (além do reset de estado no `catch` já citado no fator 4).

---

## 8. Skincare IA — enviar fotos para a API

**O que foi revisado**
- Em `skincare.views.js`, antes de `gerarSkincare`, as fotos em `skincareFotosCabine` (blob URL ou data URL) são convertidas para base64 e enviadas em `payload.fotos`.
- O backend atual pode ignorar `fotos`; o payload já está pronto para quando a API passar a usar.

**Nenhum ajuste necessário.**

---

## 9. Confirmação modal em ações destrutivas

**O que foi revisado**
- Financeiro: excluir conta a pagar, meta, participação, desvincular conta.
- Equipe: remover usuário, excluir afazer.
- Calendário de conteúdo: excluir conteúdo.
- Procedimentos: excluir procedimento, excluir plano.
- Todos usam `openConfirmModal` (título, mensagem, callback). O modal `#confirmModal` existe em `dashboard.html`.

**Nenhum ajuste necessário.**

---

## 10. Avaliação de produto (Estoque)

**O que foi revisado**
- `supabase-produto-avaliacoes.sql`: tabela, índices e RLS.
- `produto-avaliacoes.service.js`: `createAvaliacao`, `listAvaliacoesByProduto`, `getIndiceCuidado`.
- Estoque: resumo por produto com botão “Avaliar”; modal com nota 1–5 e comentário; `createAvaliacao` ao enviar.
- Atributo `data-produto` no botão: valor escapado para HTML para evitar quebra com `"` ou `&`.

**Ajuste**
- `escapeAttr` em estoque passou a escapar `&` com `&amp;` além de `"` e `<`, para evitar problemas em nomes com “e comercial”.

**Arquivos**
- `supabase-produto-avaliacoes.sql`
- `js/services/produto-avaliacoes.service.js`
- `js/views/estoque.views.js`

---

## 11. Índice de cuidado (Equipe)

**O que foi revisado**
- Seção “Índice de cuidado” na view Equipe; `renderIndiceCuidado()` chama `getIndiceCuidado()` e preenche a tabela (profissional, total de avaliações, média 1–5).
- Tratamento quando a tabela `produto_avaliacoes` não existe (mensagem com nome do script SQL).

**Ajuste**
- `getIndiceCuidado()` agora ordena a lista por `total_avaliacoes` decrescente, para destacar quem mais avalia.

**Arquivos**
- `js/services/produto-avaliacoes.service.js`
- `js/views/team.views.js`
- `dashboard.html` (bloco `teamIndiceCuidadoWrap` / `listaIndiceCuidado`)
- `js/css/style.css` (estilos do índice)

---

## Scripts Supabase (lembrete)

Para tudo funcionar, é preciso rodar no projeto:

1. `supabase-audit-logs-rls-fix.sql`
2. `supabase-audit-logs-star.sql`
3. `supabase-produto-avaliacoes.sql` (após estoque e RLS de organizations)

Ordem sugerida está em `supabase-ordem-scripts.md`.
