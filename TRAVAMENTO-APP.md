# Travamento do app – checklist

Objetivo: deixar o app consistente, seguro e sem telas quebradas.

---

## 1. Permissões e acesso (front + back)

- [x] **Menu e rotas**: itens do menu e navegação por hash verificam `checkPermission(route.permission)`; rotas `master:access` só para master.
- [x] **Configurações (master)**: view `master` e subviews (Taxas, Documentos, Modelos, etc.) exigem `master:access`.
- [ ] **Ações sensíveis**: antes de excluir/alterar dados críticos (cliente, procedimento, org), garantir que a ação está coberta por permissão (e, onde existir, por RLS no Supabase).
- [ ] **RLS no Supabase**: todas as tabelas por organização devem ter policy com `org_id IN (SELECT org_id FROM organization_users WHERE user_id = auth.uid())` (ou equivalente). Revisar scripts em `supabase-rls-*.sql`.

---

## 2. Sessão e logout

- [x] **Logout**: chama `logout()` e redireciona para `/index.html`.
- [x] **Limpar estado ao sair**: ao fazer logout, `logout()` em `auth.js` chama `clearSessionState()` e remove do `sessionStorage` as chaves de navegação (clientePerfilId, profissionalPerfilId, procedimentoEditId, anamnese_*, skincare_*, etc.), evitando vazar entre usuários no mesmo navegador.
- [x] **Sessão expirada**: `setupSessionExpiredRedirect()` em `auth.js` escuta `SIGNED_OUT` e `TOKEN_REFRESH_FAILED`; `redirectToLoginIfUnauthorized(error)` para uso em chamadas fetch/API que retornem 401.

---

## 3. Navegação e IDs em sessionStorage

- [x] **Perfil de cliente**: se `clientePerfilId` não existir ou cliente não for encontrado, toast e voltar para lista de clientes.
- [x] **Perfil do profissional**: se `profissionalPerfilId` não existir ou membro não for encontrado, tratar e voltar para equipe.
- [x] **Editar procedimento (Ajustar)**: `procedimentoEditId` em sessionStorage; ao abrir view Procedimentos, abrir o modal de edição e limpar o ID.
- [ ] **Hash direto**: se o usuário colar `#cliente-perfil` sem ter id em sessionStorage, a view já redireciona? Garantir que views que dependem de ID redirecionem com mensagem clara.

---

## 4. Dados obrigatórios e consistência

- [ ] **Org ativa**: rotas protegidas dependem de `getActiveOrg()`. Se não houver org (ex.: após troca de conta), mostrar banner ou redirecionar para seleção de org / onboarding.
- [x] **Health check**: ao carregar o app, `updateAppIdentity()` chama perfil da org; se falhar, mostra banner com link para Configurações.
- [ ] **Migrações**: rodar os SQLs de migração (parcelamento, margem/comissão, etc.) no Supabase para não quebrar leitura/gravação quando o código usar as novas colunas.

---

## 5. Validação e erro

- [x] **APIs que falham**: `getOrganizationProfile()` em try/catch retorna `null`; app mostra banner em vez de quebrar.
- [ ] **Formulários**: validar obrigatórios no front (e, onde fizer sentido, constraints no banco) para não salvar estado inconsistente (ex.: procedimento sem nome, transação sem valor).

---

## 6. Resumo do que já está travado

- Menu e navegação por permissão (menu escondido e rota bloqueada com “Acesso negado”).
- Equipe: modo “gerenciar” (Convidar, Remover, Procedimentos) só para master/gestor e ao vir de Configurações.
- Financeiro: área Master (contas a pagar, fluxo, metas, etc.) só para master.
- Regra de parcelamento e margem/comissão: definidas em Configurações (acesso master); quem cobra só vê a sugestão “até Nx”.
- Limpeza de sessionStorage no logout: `clearSessionState()` em `auth.js` remove chaves de perfil/edição/anamnese/skincare ao chamar `logout()`.

---

## Próximos passos sugeridos (prioridade)

1. ~~**Logout**: limpar `sessionStorage` ao sair~~ ✅ Feito em `auth.js`.
2. ~~**401 em chamadas**: interceptar 401 (sessão expirada) e redirecionar para login + limpar org/sessionStorage~~ ✅ Feito: `setupSessionExpiredRedirect()` + `redirectToLoginIfUnauthorized()`.
3. **Revisar RLS**: conferir todas as tabelas no Supabase e garantir policy por `org_id` + `user_id`.
4. **Views que dependem de ID**: garantir que, ao abrir por hash direto sem ID, redirecionem com toast em vez de tela em branco ou erro.
