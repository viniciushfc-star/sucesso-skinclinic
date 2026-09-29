# Auditoria P0/P1 — 2026-09-29

Escopo: manutenção em produto existente. Sem Playwright no repo.

## Comprovado

- Bootstrap com org → `dashboard`; Agenda continua rota SPA.
- Health: 503 se o load de rota crítica falhar (`lib/api-health.js`). Críticas: portal, lembretes-auto, whatsapp-send. Copiloto/OCR fora.
- Lembrete WhatsApp: silêncio humano bloqueia envio (`decisaoWhatsappLembrete`).
- SQL/migration `create_client_portal_session`: `extensions.gen_random_bytes` + `search_path`.
- Fail-closed de papel sem mapa (`viewer` / inexistente).
- E2E Golden Flow com JWT nesta máquina (grava/lê ciclo). `ui-browser` continua `NÃO COMPROVADO`.
- RLS **tabelas** live (JWT): leak_org_b=0 nas tabelas do probe; INSERT em org B `42501`. Relatório: `docs/FASE-2-RLS-ORG-AB.md`.
- Storage list: sem pasta de org B visível.
- Live 2026-09-29: `create_client_portal_session` devolve token; `get_client_by_token` lê o cliente certo e **não** traz `ia_preliminar`. Token lixo = 0 linhas. Sessão de prova foi expirada.
- Digest + pele no live: `get_client_session_by_token` ok; `get_analises_pele_by_token` sem 42601/42804, token lixo = 0 linhas, token válido = lista (0 neste cliente) **sem** `ia_preliminar`.

## Falhou

- APIs na Vercel (live 2026-09-29): JWT **sem** token = 401; com token, **org A e org B** = 500. Não era só isolamento A≠B: o runtime da Vercel estoura depois do Bearer. Correção no Git: membership vazia → 403; catálogo de permissão com erro → cai na role (não 500); JWT valida também via service role se a anon faltar; `wrap` mapeia `ApiAuthError` 401/403/400. **Só vale depois do deploy.**
- `npm test` completo: 250/251; falha era regex antiga do SW no lote 9. Assert corrigido; lote 9 reexecutado verde. Suite inteira **não** rodou de novo depois.

## Risco

- Working tree ≠ Git HEAD. Deploy só do remoto perde health, E2E e UX local.
- E2E pode deixar clientes `E2E-GF-*` se DELETE for recusado pelo RLS.
- Health 503 na Vercel só vale depois do deploy deste `server.js`.
- Tabelas `agenda_google_events` e `package_consumptions` ainda ausentes no live.

## Não comprovado

- UI no browser (login, dashboard, agenda).
- Cron de lembretes em produção.
