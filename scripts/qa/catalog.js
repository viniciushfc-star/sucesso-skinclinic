/**
 * Catálogo de cenários de QA SkinClinic (Vercel + 3 papéis).
 * IDs estáveis. Rode: node scripts/qa/catalog.js
 */

export const BASE_DEFAULT = "https://skinclinic-one.vercel.app";

export const ROLES = ["funcionario", "gestor", "master"];

export const PAGES = [
  "/",
  "/index.html",
  "/dashboard.html",
  "/dashboard",
  "/portal.html",
  "/reset.html",
  "/reset",
  "/new-password.html",
  "/onboarding.html",
  "/onboarding",
  "/onboarding/index.html",
  "/auth-callback.html",
  "/agendar.html",
  "/agendar",
  "/agenda.html",
  "/accept-invite.html",
  "/accept-invite",
  "/create-org.html",
  "/select-org",
  "/manifest.json",
  "/sw.js",
  "/js/css/style.css",
  "/js/css/onboarding.css",
];

export const BLOCKED = [
  "/routes/copiloto.js",
  "/routes/preco.js",
  "/routes/google-calendar/auth.js",
  "/server.js",
  "/api/index.js",
  "/.env",
  "/.env.local",
  "/.env.example",
  "/google-key.json",
  "/package.json",
  "/package-lock.json",
  "/vercel.json",
  "/lib/api-auth.js",
  "/ai/core/index.js",
  "/supabase/supabase-p0-rls-isolamento.sql",
  "/scripts/test-p0-01-auth.js",
  "/scripts/qa/catalog.js",
  "/scripts/qa/provision-test-users.js",
  "/node_modules/express/package.json",
  "/.git/HEAD",
  "/.git/config",
];

/** Rotas que não existem de propósito: não podem 5xx nem vazar admin. */
export const PHANTOM = [
  "/api",
  "/api/",
  "/api/admin",
  "/api/users",
  "/api/login",
  "/api/logout",
  "/api/graphql",
  "/api/v1/clients",
  "/api/v2/health",
  "/api/internal",
  "/api/debug",
  "/api/config",
  "/api/secrets",
  "/api/env",
  "/api/me",
  "/api/organizations",
  "/api/clients",
  "/api/agenda",
  "/api/financeiro",
  "/api/backup",
  "/api/export",
  "/api/team",
  "/api/invites",
  "/api/portal",
  "/api/auth",
  "/api/session",
  "/api/openai",
  "/api/stripe",
  "/api/pagamento",
  "/api/webhooks",
  "/api/cron",
  "/api/reset-password",
  "/api/upload",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/.well-known/security.txt",
  "/wp-admin",
  "/phpinfo.php",
  "/actuator/health",
  "/server-status",
];

export const HTTP_VERBS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];

export const POST_APIS = [
  "/api/copiloto",
  "/api/preco",
  "/api/marketing",
  "/api/ocr",
  "/api/estoque",
  "/api/estudo-caso-pergunta",
  "/api/estudo-caso-esclarecer",
  "/api/discussao-caso",
  "/api/protocolo",
  "/api/pele",
  "/api/skincare",
  "/api/skincare-ai",
  "/api/analise-pele",
  "/api/analise-pele-fotos",
  "/api/analise-pele-portal-list",
  "/api/calendario-conteudo",
  "/api/webhook-transacoes",
  "/api/create-portal-session",
  "/api/send-invite-email",
  "/api/lembretes-auto",
  "/api/whatsapp-send",
  "/api/audit-log",
  "/api/google-calendar/sync",
  "/api/google-calendar/disconnect",
];

export const GET_APIS = [
  "/api/health",
  "/api/lembretes-auto",
  "/api/integracoes-status",
  "/api/calendario-conteudo",
  "/api/google-calendar/auth",
  "/api/google-calendar/callback",
  "/api/google-calendar/status",
  "/api/ops-summary",
];

export const VIEWS = [
  "dashboard",
  "agenda",
  "procedimento",
  "clientes",
  "cliente-perfil",
  "profissional-perfil",
  "financeiro",
  "precificacao-taxas",
  "notificacoes",
  "team",
  "planos",
  "empresa",
  "auditoria",
  "backup",
  "export",
  "master",
  "pagamento",
  "copiloto",
  "marketing",
  "crm",
  "calendario-conteudo",
  "estoque",
  "ocr",
  "skincare",
  "protocolo",
  "estudo-caso",
  "anamnese",
  "analise-pele",
  "documentos-termos",
  "modelos-mensagem",
  "para-clinicas",
  "select-org",
  "onboarding",
  "accept-invite",
  "login",
];

/** Permissão de API (backend). funcionario não tem ia/whatsapp/portal. */
export const API_PERM = {
  "/api/copiloto": { perm: "ia:copilot", gestor: true, master: true, funcionario: false },
  "/api/preco": { perm: "ia:assist", gestor: true, master: true, funcionario: false },
  "/api/marketing": { perm: "ia:assist", gestor: true, master: true, funcionario: false },
  "/api/ocr": { perm: "ia:assist", gestor: true, master: true, funcionario: false },
  "/api/estoque": { perm: "ia:assist", gestor: true, master: true, funcionario: false },
  "/api/estudo-caso-pergunta": { perm: "ia:assist", gestor: true, master: true, funcionario: false },
  "/api/estudo-caso-esclarecer": { perm: "ia:assist", gestor: true, master: true, funcionario: false },
  "/api/discussao-caso": { perm: "ia:assist", gestor: true, master: true, funcionario: false },
  "/api/protocolo": { perm: "ia:assist", gestor: true, master: true, funcionario: false },
  "/api/pele": { perm: "ia:assist", gestor: true, master: true, funcionario: false },
  "/api/skincare": { perm: "ia:assist", gestor: true, master: true, funcionario: false },
  "/api/skincare-ai": { perm: "ia:assist", gestor: true, master: true, funcionario: false },
  "/api/whatsapp-send": { perm: "whatsapp:send", gestor: true, master: true, funcionario: false },
  "/api/audit-log": { perm: "dashboard:view", gestor: true, master: true, funcionario: true },
  "/api/create-portal-session": { perm: "clientes:manage", gestor: true, master: true, funcionario: false },
  "/api/ops-summary": { perm: "auditoria:view", gestor: true, master: true, funcionario: false },
  "/api/send-invite-email": { perm: "team:invite", gestor: true, master: true, funcionario: false },
  "/api/analise-pele-fotos": { perm: "clientes:view", gestor: true, master: true, funcionario: true },
  "/api/google-calendar/sync": { perm: "dashboard:view", gestor: true, master: true, funcionario: true },
  "/api/google-calendar/disconnect": { perm: "dashboard:view", gestor: true, master: true, funcionario: true },
  "/api/lembretes-auto": { perm: "dashboard:view", gestor: true, master: true, funcionario: true },
};

const FAKE_ORG = "00000000-0000-4000-8000-000000000099";
const FAKE_USER = "11111111-1111-4111-8111-111111111111";
const ORG_CTX = String(process.env.QA_ORG_ID || "").trim() || FAKE_ORG;

const FUZZ_BODIES = [
  { name: "vazio", body: "" },
  { name: "objeto-vazio", body: "{}" },
  { name: "array", body: "[]" },
  { name: "null", body: "null" },
  { name: "numero", body: "1" },
  { name: "bool", body: "true" },
  { name: "texto", body: "nao-json" },
  { name: "org-spoof", body: JSON.stringify({ org_id: FAKE_ORG, orgId: FAKE_ORG }) },
  { name: "xss", body: JSON.stringify({ q: "<script>alert(1)</script>", question: "<img src=x onerror=alert(1)>" }) },
  { name: "sql", body: JSON.stringify({ id: "1; DROP TABLE clients;--" }) },
  { name: "unicode", body: JSON.stringify({ nome: "clinica 测试 🎉" }) },
  { name: "longo", body: JSON.stringify({ texto: "A".repeat(8000) }) },
  { name: "uuid-lixo", body: JSON.stringify({ client_id: "nao-uuid", userId: FAKE_USER }) },
  { name: "token-portal", body: JSON.stringify({ token: "x".repeat(64) }) },
  { name: "email-lixo", body: JSON.stringify({ email: "nao-e-email", role: "master" }) },
];

function slug(s) {
  return String(s)
    .replace(/^\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function viewAccess(role, view) {
  if (role === "funcionario") {
    const deny = ["financeiro", "precificacao-taxas", "team", "profissional-perfil", "planos", "auditoria", "backup", "export", "master", "pagamento", "documentos-termos", "modelos-mensagem"];
    if (deny.includes(view)) return "deny-ui";
    return "open-ui";
  }
  if (view === "master" || view === "documentos-termos" || view === "modelos-mensagem") {
    return role === "master" ? "open-ui" : "deny-ui";
  }
  if (view === "pagamento") return "hidden-flag";
  return "open-ui";
}

export function buildCatalog() {
  const cases = [];
  const seen = new Set();

  function add(partial) {
    const id = partial.id;
    if (seen.has(id)) throw new Error("id duplicado: " + id);
    seen.add(id);
    cases.push({
      live: "none",
      expectStatus: null,
      ...partial,
    });
  }

  add({
    id: "pub-health-ok",
    family: "saude",
    title: "GET /api/health responde ok na Vercel",
    live: "anon",
    method: "GET",
    path: "/api/health",
    expectStatus: [200],
  });

  for (const page of PAGES) {
    add({
      id: `pub-page-${slug(page)}`,
      family: "paginas",
      title: `GET ${page} não 5xx`,
      live: "anon",
      method: "GET",
      path: page,
      expectStatus: [200, 301, 302, 304, 404],
    });
    add({
      id: `pub-page-xssq-${slug(page)}`,
      family: "paginas",
      title: `GET ${page} com query XSS não 5xx`,
      live: "anon",
      method: "GET",
      path: `${page}?q=<script>alert(1)</script>`,
      expectStatus: [200, 301, 302, 304, 400, 404],
    });
    add({
      id: `hdr-nosniff-${slug(page)}`,
      family: "headers",
      title: `${page} envia X-Content-Type-Options (se HTML/API da origem)`,
      live: "anon-header",
      method: "GET",
      path: page,
      header: "x-content-type-options",
      headerValue: "nosniff",
      optionalHeader: true,
    });
  }

  for (const p of BLOCKED) {
    add({
      id: `sec-block-${slug(p)}`,
      family: "estatico-bloqueado",
      title: `GET ${p} não entrega fonte (404)`,
      live: "anon",
      method: "GET",
      path: p,
      expectStatus: [404, 403],
    });
  }

  for (const api of POST_APIS) {
    add({
      id: `anon-post-${slug(api)}`,
      family: "api-anon",
      title: `POST ${api} sem JWT não autentica`,
      live: "anon",
      method: "POST",
      path: api,
      json: {},
      expectStatus: [400, 401, 403, 404, 405],
    });
    if (!GET_APIS.includes(api)) {
      add({
        id: `anon-get-on-post-${slug(api)}`,
        family: "api-metodo",
        title: `GET ${api} (rota POST) não processa como POST`,
        live: "anon",
        method: "GET",
        path: api,
        expectStatus: [400, 401, 403, 404, 405],
      });
    }
  }

  for (const api of GET_APIS) {
    if (api === "/api/health") continue;
    add({
      id: `anon-get-${slug(api)}`,
      family: "api-anon",
      title: `GET ${api} sem sessão adequada`,
      live: "anon",
      method: "GET",
      path: api,
      expectStatus: api.includes("callback")
        ? [200, 301, 302, 303, 307, 400, 401, 403, 404, 405]
        : [200, 400, 401, 403, 404, 405],
    });
  }

  const origins = [
    "https://evil.example",
    "http://localhost:9999",
    "https://skinclinic-one.vercel.app.evil.com",
    "null",
  ];
  for (const origin of origins) {
    add({
      id: `cors-evil-${slug(origin)}`,
      family: "cors",
      title: `CORS não ecoa Origin ${origin} em /api/health`,
      live: "cors",
      method: "GET",
      path: "/api/health",
      origin,
      expectNoAllowOrigin: origin === "https://skinclinic-one.vercel.app" ? false : true,
    });
  }
  add({
    id: "cors-prod-allow",
    family: "cors",
    title: "Origin de produção pode aparecer no ACAO",
    live: "cors",
    method: "GET",
    path: "/api/health",
    origin: "https://skinclinic-one.vercel.app",
    expectNoAllowOrigin: false,
  });

  for (const api of POST_APIS) {
    for (const fuzz of FUZZ_BODIES) {
      const costly = /copiloto|preco|marketing|ocr|estoque|estudo|discussao|protocolo|pele|skincare/.test(api);
      add({
        id: `fuzz-${slug(api)}-${fuzz.name}`,
        family: "fuzz",
        title: `POST ${api} payload ${fuzz.name} sem JWT`,
        live: costly ? "anon-light" : "anon",
        method: "POST",
        path: api,
        rawBody: fuzz.body,
        contentType: "application/json",
        expectStatus: [400, 401, 403, 404, 405, 413, 415, 422],
      });
    }
  }

  const portalApis = ["/api/analise-pele", "/api/analise-pele-portal-list"];
  const tokens = [
    { name: "ausente", json: {} },
    { name: "vazio", json: { token: "" } },
    { name: "curto", json: { token: "abc" } },
    { name: "sql", json: { token: "' OR 1=1 --" } },
    { name: "xss", json: { token: "<script>" } },
    { name: "uuid", json: { token: FAKE_ORG } },
  ];
  for (const api of portalApis) {
    for (const t of tokens) {
      add({
        id: `portal-${slug(api)}-${t.name}`,
        family: "portal",
        title: `Portal ${api} token ${t.name}`,
        live: "anon",
        method: "POST",
        path: api,
        json: t.json,
        expectStatus: [400, 401, 403],
      });
    }
  }

  add({
    id: "wh-sem-secret",
    family: "webhook",
    title: "Webhook sem secret → 401 ou 403",
    live: "anon",
    method: "POST",
    path: "/api/webhook-transacoes",
    json: { account_id: "x", transactions: [] },
    expectStatus: [401, 403],
  });
  add({
    id: "wh-secret-errado",
    family: "webhook",
    title: "Webhook secret errado → 401 ou 403",
    live: "anon",
    method: "POST",
    path: "/api/webhook-transacoes",
    json: { account_id: "x", transactions: [{ date: "2026-01-01", amount: 1 }] },
    headers: { "x-webhook-secret": "errado" },
    expectStatus: [401, 403],
  });

  add({
    id: "cron-sem-secret-get",
    family: "cron",
    title: "GET lembretes-auto sem cron/JWT",
    live: "anon",
    method: "GET",
    path: "/api/lembretes-auto",
    expectStatus: [401, 403],
  });

  for (const role of ROLES) {
    for (const view of VIEWS) {
      const expect = viewAccess(role, view);
      add({
        id: `ui-${role}-${view}`,
        family: "ui-papel",
        title: `${role} abre #${view} (${expect})`,
        live: "auth-ui",
        role,
        view,
        expect,
      });
    }
    for (const [api, spec] of Object.entries(API_PERM)) {
      const allowed = spec[role] === true;
      add({
        id: `auth-api-${role}-${slug(api)}`,
        family: "api-papel",
        title: `${role} POST ${api} → ${allowed ? "não 403 de permissão (pode 400)" : "403"}`,
        live: "auth-api",
        role,
        method: "POST",
        path: api,
        json: { org_id: ORG_CTX },
        expectForbidden: !allowed,
        skipUnlessLive: /copiloto|preco|marketing|ocr|estoque|estudo|discussao|protocolo|pele|skincare|whatsapp|create-portal|send-invite|google-calendar/.test(api),
      });
      add({
        id: `auth-spoof-org-${role}-${slug(api)}`,
        family: "multi-tenant",
        title: `${role} envia org_id de outra clínica em ${api}`,
        live: "auth-api",
        role,
        method: "POST",
        path: api,
        json: { org_id: FAKE_ORG },
        expectStatus: [400, 401, 403, 404],
        skipUnlessLive: true,
      });
    }
  }

  const extraUi = [
    ["funcionario", "gerar-link-portal", "deny"],
    ["gestor", "gerar-link-portal", "allow"],
    ["master", "gerar-link-portal", "allow"],
    ["funcionario", "whatsapp-api", "deny"],
    ["gestor", "whatsapp-api", "allow"],
    ["funcionario", "copiloto-enviar", "deny"],
    ["gestor", "copiloto-enviar", "allow"],
    ["funcionario", "financeiro-ver", "deny"],
    ["gestor", "financeiro-ver", "allow"],
    ["funcionario", "equipe-convidar", "deny"],
    ["gestor", "equipe-convidar", "allow"],
    ["funcionario", "backup-restaurar", "deny"],
    ["gestor", "backup-restaurar", "allow"],
    ["master", "configuracoes", "allow"],
    ["gestor", "configuracoes", "deny"],
    ["funcionario", "configuracoes", "deny"],
  ];
  for (const [role, feat, expect] of extraUi) {
    add({
      id: `feat-${role}-${feat}`,
      family: "feature-papel",
      title: `${role} ${feat} → ${expect}`,
      live: "auth-ui",
      role,
      feature: feat,
      expect,
    });
  }

  const authPages = [
    ["login-vazio", "login sem e-mail"],
    ["login-senha-curta", "login senha 1 char"],
    ["login-invalido", "login credencial errada"],
    ["cadastro-senha-curta", "cadastro senha < 6"],
    ["cadastro-senhas-diferentes", "cadastro senhas diferentes"],
    ["cadastro-email-invalido", "cadastro e-mail inválido"],
    ["reset-email-invalido", "reset e-mail inválido"],
    ["reset-ok-formato", "reset e-mail formato ok"],
    ["nova-senha-sem-hash", "new-password sem link do e-mail"],
    ["google-botao", "botão Google não quebra a página"],
  ];
  for (const [id, title] of authPages) {
    add({
      id: `fluxo-${id}`,
      family: "auth-ui",
      title,
      live: "manual-or-ui",
    });
  }

  const safeNo5xx = [200, 201, 204, 301, 302, 303, 304, 307, 308, 400, 401, 403, 404, 405, 409, 410, 413, 415, 422, 429];

  for (let i = 0; i < PHANTOM.length; i++) {
    const path = PHANTOM[i];
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]) {
      add({
        id: `phantom-${method.toLowerCase()}-${i}-${slug(path) || "root"}`,
        family: "rotas-fantasma",
        title: `${method} ${path} (rota inexistente) não 5xx`,
        live: "anon",
        method,
        path,
        json: method === "GET" || method === "HEAD" || method === "OPTIONS" ? undefined : {},
        expectStatus: safeNo5xx,
      });
    }
  }

  const methodTargets = [...new Set([...POST_APIS, ...GET_APIS])];
  for (const api of methodTargets) {
    for (const method of HTTP_VERBS) {
      if (method === "GET" && GET_APIS.includes(api)) continue;
      if (method === "POST" && POST_APIS.includes(api)) continue;
      if (method === "GET" && POST_APIS.includes(api)) continue;
      add({
        id: `verb-${method.toLowerCase()}-${slug(api)}`,
        family: "api-metodo",
        title: `${method} ${api} método atípico`,
        live: "anon",
        method,
        path: api,
        json: method === "GET" || method === "HEAD" || method === "OPTIONS" ? undefined : {},
        expectStatus: safeNo5xx,
      });
    }
  }

  const tricks = [
    ["/api/health/", "health-slash"],
    ["/api/health?", "health-qempty"],
    ["//api/health", "health-doubleslash"],
    ["/api/../package.json", "dotdot-package"],
    ["/api/%2e%2e/package.json", "enc-dotdot-package"],
    ["/API/HEALTH", "health-upper"],
    ["/api/health.json", "health-json-ext"],
    ["/api/copiloto/", "copiloto-slash"],
    ["/api/copiloto.json", "copiloto-json-ext"],
    ["/routes%2fcopiloto.js", "enc-routes-copiloto"],
    ["/./server.js", "dot-server"],
    ["/dashboard.html/", "dashboard-slash"],
    ["/index.html/..", "index-dotdot"],
    ["/api/google-calendar/callback/", "gcal-cb-slash"],
    ["/api/google-calendar/auth/", "gcal-auth-slash"],
    ["/api/lembretes-auto/", "lembretes-slash"],
    ["/api/webhook-transacoes/", "webhook-slash"],
  ];
  for (const [path, name] of tricks) {
    add({
      id: `trick-get-${name}`,
      family: "path-trick",
      title: `GET ${path}`,
      live: "anon",
      method: "GET",
      path,
      expectStatus: safeNo5xx,
    });
  }

  const qfuzz = [
    "?org_id=" + FAKE_ORG,
    "?org=" + FAKE_ORG,
    "?q=<script>alert(1)</script>",
    "?id=1;DROP TABLE clients;--",
    "?token=" + "a".repeat(128),
    "?redirect=https://evil.example",
    "?code=abc&state=abc",
    "?callback=alert",
    "?__proto__[admin]=true",
  ];
  for (const api of GET_APIS) {
    qfuzz.forEach((q, i) => {
      add({
        id: `qfuzz-${slug(api)}-${i}`,
        family: "query-fuzz",
        title: `GET ${api}${q}`,
        live: "anon",
        method: "GET",
        path: api + q,
        expectStatus: safeNo5xx,
      });
    });
  }

  const authGets = [
    "/api/health",
    "/api/integracoes-status",
    "/api/calendario-conteudo",
    "/api/google-calendar/status",
    "/api/google-calendar/auth",
    "/api/google-calendar/callback",
    "/api/lembretes-auto",
  ];
  for (const role of ROLES) {
    for (const api of authGets) {
      add({
        id: `auth-get-${role}-${slug(api)}`,
        family: "api-papel-get",
        title: `${role} GET ${api}`,
        live: "auth-api",
        role,
        method: "GET",
        path: `${api}?org_id=${ORG_CTX}&org=${ORG_CTX}`,
        expectStatus: safeNo5xx,
      });
    }
    for (const api of POST_APIS) {
      add({
        id: `auth-put-${role}-${slug(api)}`,
        family: "api-papel-verb",
        title: `${role} PUT ${api}`,
        live: "auth-api",
        role,
        method: "PUT",
        path: api,
        json: { org_id: ORG_CTX },
        expectStatus: safeNo5xx,
      });
      add({
        id: `auth-del-${role}-${slug(api)}`,
        family: "api-papel-verb",
        title: `${role} DELETE ${api}`,
        live: "auth-api",
        role,
        method: "DELETE",
        path: api,
        json: { org_id: ORG_CTX },
        expectStatus: safeNo5xx,
      });
    }
  }

  return cases;
}

export function catalogStats(cases = buildCatalog()) {
  const byFamily = {};
  const byLive = {};
  for (const c of cases) {
    byFamily[c.family] = (byFamily[c.family] || 0) + 1;
    byLive[c.live] = (byLive[c.live] || 0) + 1;
  }
  return { total: cases.length, byFamily, byLive };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/qa/catalog.js");
if (isMain) {
  const cases = buildCatalog();
  const stats = catalogStats(cases);
  console.log(JSON.stringify(stats, null, 2));
}
