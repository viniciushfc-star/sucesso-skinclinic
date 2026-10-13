# Auditoria P0/P1 — 2026-09-29

Escopo: manutenção em produto existente. Sem Playwright no repo.

## Comprovado

- Bootstrap com org → `dashboard`; Agenda continua rota SPA.
- Health: 503 se o load de rota crítica falhar (`lib/api-health.js`). Críticas: portal, lembretes-auto, whatsapp-send. Copiloto/OCR fora.
- Lembrete WhatsApp: silêncio humano bloqueia envio (`decisaoWhatsappLembrete`).
- SQL/migration `create_client_portal_session`: `extensions.gen_random_bytes` + `search_path`.
- Fail-closed de papel sem mapa (`viewer` / inexistente).
- E2E Golden Flow com JWT nesta máquina (grava/lê ciclo). `ui-browser` continua `NÃO COMPROVADO`.
- RLS **tabelas** live (JWT): leak_org_b=0; INSERT org B `42501`. APIs Vercel após deploy `f0c2c7b`: org B **403** (copiloto, preço, marketing, WhatsApp, audit, portal). Org A: portal 404 (cliente fake), WhatsApp fallback, Copiloto 200. `npm run test:rls-ab` **PASS 48 / FAIL 0**. Relatório: `docs/FASE-2-RLS-ORG-AB.md`.
- Live 2026-09-29: `create_client_portal_session` devolve token; `get_client_by_token` lê o cliente certo e **não** traz `ia_preliminar`. Token lixo = 0 linhas. Sessão de prova foi expirada.
- Digest + pele no live: `get_client_session_by_token` ok; `get_analises_pele_by_token` sem 42601/42804, token lixo = 0 linhas, token válido = lista (0 neste cliente) **sem** `ia_preliminar`.

## Falhou

- `npm test` completo na sessão anterior: 250/251 (regex do SW no lote 9); lote 9 corrigido. Suite inteira **não** rodou de novo depois.

## Risco

- E2E pode deixar clientes `E2E-GF-*` se DELETE for recusado pelo RLS.
- Tabelas `agenda_google_events` e `package_consumptions` ainda ausentes no live.

## Não comprovado

- UI no browser (login, dashboard, agenda).
- Cron de lembretes em produção.
