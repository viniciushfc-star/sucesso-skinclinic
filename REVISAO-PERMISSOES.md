# Revisão de permissões por usuário

## Resumo

Foi revisado o fluxo de permissões (roles, mapa, checagem, overrides) e corrigidos os pontos abaixo.

---

## 1. Dois `checkPermission` (erro)

- **Problema:** Em `js/services/permissions.service.js` existia um `checkPermission` que usava `permissionsMap[role]` — mas `permissionsMap` **nunca foi definido** nesse arquivo, o que geraria `ReferenceError` se alguém o chamasse.
- **Uso real:** Todas as views e o SPA importam `checkPermission` de `js/core/permissions.js`, que usa `ROLE_PERMISSIONS` e a tabela de overrides. Ninguém importava o `checkPermission` do service.
- **Ajuste:** O `checkPermission` duplicado e quebrado foi **removido** de `permissions.service.js`. A única fonte de verdade para checagem de permissão é `js/core/permissions.js`.

---

## 2. Overrides por usuário (tela Equipe)

- **Problema:** `team-permissions.views.js` importa `getUserPermissionOverrides` e `saveUserPermissionOverride` de `permissions.service.js`, mas essas funções **não existiam**, o que quebraria a tela de “Configurar permissões” de um membro.
- **Ajuste:**
  - Implementadas em `permissions.service.js`:
    - `getUserPermissionOverrides(userId)` — lê da tabela `organization_user_permissions` (org ativa + usuário).
    - `saveUserPermissionOverride({ userId, permission, allowed })` — faz upsert na mesma tabela e chama `clearRoleCache()`.
  - Criado o script **`supabase-organization-user-permissions.sql`** para criar a tabela com `UNIQUE(org_id, user_id, permission)` e RLS (leitura para membros da org; escrita só para master/gestor).

---

## 3. Permissões usadas nas rotas mas fora do mapa

- **Problema:** As rotas **Planos** e **Backup** usam `planos:view` e `backup:view` (e a view de Backup usa também `backup:restore`), mas essas chaves **não estavam** em `ROLE_PERMISSIONS` nem em `PERMISSIONS`. Só o **master** (`*`) conseguia acessar; o **gestor** ficava sem menu/item.
- **Ajuste:** Em `permissions.map.js`:
  - Incluídas no **gestor:** `planos:view`, `backup:view`, `backup:restore`.
  - Incluídas no catálogo **PERMISSIONS:**  
    `planos:view`, `backup:view`, `backup:restore` (com labels), para aparecerem na tela de overrides da equipe.

---

## 4. Fluxo atual (referência)

| Quem          | Onde está definido              | Uso |
|---------------|----------------------------------|-----|
| **Roles**     | `organization_users.role`       | master, gestor, funcionario (e eventualmente admin, viewer) |
| **Mapa**      | `permissions.map.js` → `ROLE_PERMISSIONS` | Conjunto de permissões por role (gestor, funcionario); master tem `*` |
| **Checagem**  | `core/permissions.js` → `checkPermission(permission)` | 1) Org ativa 2) User 3) Override em `organization_user_permissions` 4) Se master → true 5) Senão `ROLE_PERMISSIONS[role].includes(permission)` |
| **Overrides** | `organization_user_permissions` | Por (org_id, user_id, permission); lido/escrito por `permissions.service.js`; compatibilidade auditoria com `logs:view` / `logs:acknowledge` em `core/permissions.js` |

---

## 5. Script SQL novo

- **supabase-organization-user-permissions.sql**  
  Criar e rodar após `supabase-rls-organizations.sql` para a tela de permissões por usuário (Equipe) e os overrides funcionarem.

---

## 6. O que não foi alterado

- **master:access** — continua só para master (retorno antecipado `role === "master"` em `checkPermission`); não precisa estar no mapa.
- **Compatibilidade auditoria** — `auditoria:view` / `auditoria:acknowledge` continuam aceitando override legado de `logs:view` / `logs:acknowledge` em `core/permissions.js`.
- **applyPermissions** — continua usando roles `admin` e `viewer` apenas para UI (admin-only, viewer desabilita botões); esses roles não estão em `ROLE_PERMISSIONS` e ficam com array vazio na checagem normal.
