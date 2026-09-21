# Fase 1 — Banco (ciclo 2)

**CICLO:** 2 — FASE 1  
**DATA:** 2026-09-21  
**OBJETIVO:** verdade do schema live + P0 de escrita duplicada e fail-closed.  
**NÃO** é dump `pg_dump`. **NÃO** apagamos tabelas legado no live.

## Evidências live (service role, head count)

Projeto: host em `docs/FASE-1-PROBE-LIVE.md`.

**63/63 tabelas sondadas EXISTEM**, inclusive legado.

| Tabela | Linhas | Interpretação |
|--------|--------|----------------|
| `agenda` | 3 | Canônico da grade |
| `appointments` | **0** | Código legado; nenhum dado |
| `clients` | 4 | Canônico |
| `clientes` | 3 | **IDs 100% distintos** de `clients` (0 overlap) |
| `organization_invites` | 13 | Canônico de convite |
| `convites` | 1 | Legado |
| `audit_logs` | 50 | Canônico |
| `logs` | 2 | Legado |
| `assinaturas` | 0 | Órfão (`limits.service`) |
| `organization_user_permissions` | existe | Fail-closed de catálogo **não quebra** o live atual |

**RLS Org A ≠ Org B:** ainda **NÃO COMPROVADO** (não rodamos usuários de duas orgs).

## Alterações realizadas (Git)

1. `lib/api-auth.js` — catálogo ausente em `VERCEL_ENV` production/preview ou `NODE_ENV=production` → **500**, não role.  
2. `appointments.service.js` + `confirmations.service.js` — param de gravar/ler **`agenda`**.  
3. `user.service.js` `inviteUser` — **não** chama mais Edge `dynamic-api`. UI já usa `org.js` → `organization_invites`.  
4. `spa.js` — erro em `checkPermission` **não** mostra o item do menu.  
5. Migration `supabase/migrations/20260921120000_p0_fase1_permissions_profiles.sql` — IF NOT EXISTS permissões + RLS profiles **sem** `USING (true)`.  
6. Scripts `schema-probe-live.js`, `schema-count-dup.js`, `schema-overlap-clients.js`.

## O que NÃO fizemos (de propósito)

- **Não** unificar `clientes` → `clients`: 3 pacientes só em `clientes`. Merge é P1 com prévia e confirmação. Fallback no FE **mantido**.  
- **Não** DROP `appointments`/`convites`/`logs`.  
- **Não** aplicar a migration no Dashboard por este chat — **você precisa rodar o SQL no Supabase**.  
- **Não** Intelligence / preço / gamificação.

## Testes

`npm test` (p0-01 inclui `isDeployedRuntime` / catálogo).

## Riscos restantes

- RLS live não testada com dois JWTs.  
- `profiles` policy nova só vale **depois** da migration.  
- `createAppointment` agora exige colunas de `agenda` (`duration_minutes` no SQL modelo). Função não era usada pela grade.  
- Menu pode esconder itens se `checkPermission` falhar por rede (fail-closed UX).

## Dependências / próximo ciclo

1. Aplicar `20260921120000_p0_fase1_permissions_profiles.sql` no SQL Editor.  
2. Ciclo 3: prova RLS A≠B (dois usuários) **sem** misturar P2.  
3. Depois: plano de merge `clientes` → `clients` com backup.
