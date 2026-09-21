# Mapa de permissões SkinClinic — 2026

**Código:** `js/core/permissions.map.js` + `lib/api-auth.js` + `js/core/permissions.js` + rotas SPA em `spa.js`.

## Papéis no mapa (canônico de código hoje)

| Role | Normalização | Permissões |
|------|----------------|------------|
| `master` | — | `*` |
| `gestor` | — | lista explícita (dashboard, agenda, clientes, team, financeiro, relatorios, logs/auditoria, planos, backup, whatsapp, ia, estoque:view) |
| `staff` | → `funcionario` | |
| `funcionario` | | **apenas** `dashboard:view`, `agenda:view`, `clientes:view` |

**Não estão no ROLE_PERMISSIONS:** `viewer`, `admin`, `profissional`, `recepção` (briefing).  
`permissions.js` ainda trata `admin-only` e `viewer` na UI — **CONFLITANTE / LEGADO**.

## Catálogo `PERMISSIONS` vs role

Chaves no array que **gestor não tem** no ROLE_PERMISSIONS (só master `*` ou override):  
`clientes:export`, `financeiro:manage`, `financeiro:export`, `team:remove`, `relatorios:export`.

`funcionario` **não** tem `ia:assist` / `ia:copilot` / `financeiro:view` / `estoque:view` no mapa. APIs de IA devem 403 para funcionario **se** requirePermission rodar.  
SPA `#procedimento` e várias IAs no menu usam `permission: "dashboard:view"` → **funcionario entra na tela**; persistência depende de RLS.

## Override

Tabela `organization_user_permissions`. Override `allowed: false` = 403.  
Tabela ausente = **role** (`isMissingPermissionCatalog`). **P0 fail-open de catálogo.**

## SPA vs API (evidência)

| View | Permission SPA |
|------|----------------|
| dashboard, notificacoes, empresa, copiloto*, marketing, crm, estoque, ocr, skincare, protocolo, estudo-caso, anamnese, analise-pele, para-clinicas | muitas = `dashboard:view` |
| agenda | agenda:view |
| clientes, perfil | clientes:view |
| financeiro, taxas | financeiro:view |
| team | team:view |
| planos | planos:view |
| auditoria | auditoria:view |
| backup | backup:view |
| export | relatorios:view |
| master, documentos, modelos | master:access (**não está no PERMISSIONS array** — só master `*`?) |
| pagamento | backup:view (flag off) |

\* copiloto view = `dashboard:view`; API copiloto = `ia:copilot`. **Divergência:** funcionario pode abrir tela e falhar na API.

## Autoridade

- Browser `checkPermission`: UX.  
- API `requireStaffAccess`: JWT + membership + permission.  
- Postgres RLS: dados. Os três **devem** coincidir; hoje **não** coincidem em várias rotas.

**LIVE:** se o catálogo existe em produção = **NÃO COMPROVADO**.
