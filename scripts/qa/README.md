# Bateria de QA (Vercel + 3 logins)

Há **600+ tipos de teste** gerados em `catalog.js` (páginas, arquivos bloqueados, APIs sem JWT, fuzz de payload, CORS, portal, webhook, e matriz **funcionário / gestor / master**).

## Contar cenários

```bash
node scripts/qa/catalog.js
npm run test:qa-catalog
```

## Rodar contra a Vercel (sem login)

Não chama Copiloto/IA com conta logada. Só probes públicos (401/404/CORS/health).

```bash
npm run qa:vercel
```

Padrão: `https://skinclinic-one.vercel.app`. Outra URL: `QA_BASE_URL=https://... npm run qa:vercel`.

## Com os 3 logins ativos

No `.env` local (nunca no Git):

```
QA_RUN_AUTH=1
QA_EMAIL_FUNCIONARIO=...
QA_PASS_FUNCIONARIO=...
QA_EMAIL_GESTOR=...
QA_PASS_GESTOR=...
QA_EMAIL_MASTER=...
QA_PASS_MASTER=...
SUPABASE_URL=https://....supabase.co
SUPABASE_ANON_KEY=eyJ...
```

```bash
QA_RUN_AUTH=1 npm run qa:vercel
```

Isso valida **403** do funcionário em Copiloto, WhatsApp e gerar link do portal, e que gestor/master **não** levam 403 de permissão (a API ainda pode responder 400 por body incompleto — de propósito, para não gastar OpenAI).

Para exercitar IA de verdade (custa crédito): `QA_LIVE_AI=1 QA_RUN_AUTH=1 npm run qa:vercel`.

Relatório: `scripts/qa-last-report.json` (não versionado).

## O que continua manual

Telas `#agenda`, cliques, toast, e-mail de reset: família `auth-ui` / `auth-ui` no catálogo. Use as 3 contas no browser depois do deploy.
