/**
 * Testes P0-01 — helpers de autenticação (sem inventar PASS de HTTP real).
 * Rode: npm run test:auth
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import {
  extractBearer,
  getRequestedOrgId,
  isCronAuthorized,
  permissionAllowedByRoleForTest,
  authenticateRequest,
  ApiAuthError,
  applyPermissionDecision,
  isMissingPermissionCatalog,
  isDeployedRuntime,
} from "../lib/api-auth.js";
import webhookHandler from "../routes/webhook-transacoes.js";
import { createSignedOAuthState, verifySignedOAuthState } from "../lib/oauth-state.js";
import { secretsEqual, corsOriginFor, isBlockedStaticPath, shouldNoStoreHtml } from "../lib/http-security.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function mockRes() {
  const r = {
    statusCode: 0,
    body: null,
    setHeader() {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return r;
}

describe("P0-01 helpers", () => {
  it("TESTE 1 conceitual: sem Bearer → extractBearer vazio", () => {
    assert.equal(extractBearer({ headers: {} }), "");
  });

  it("extractBearer lê Authorization", () => {
    assert.equal(extractBearer({ headers: { authorization: "Bearer abc.def" } }), "abc.def");
  });

  it("getRequestedOrgId lê contexto (não é prova)", () => {
    assert.equal(getRequestedOrgId({ body: { org_id: "o1" }, query: {} }), "o1");
    assert.equal(getRequestedOrgId({ body: {}, query: { org: "o2" } }), "o2");
  });

  it("master tem finance:view; funcionario não", () => {
    assert.equal(permissionAllowedByRoleForTest("master", "finance:view"), true);
    assert.equal(permissionAllowedByRoleForTest("master", "financeiro:view"), true);
    assert.equal(permissionAllowedByRoleForTest("funcionario", "financeiro:view"), false);
    assert.equal(permissionAllowedByRoleForTest("funcionario", "dashboard:view"), true);
    assert.equal(permissionAllowedByRoleForTest("staff", "dashboard:view"), true);
    assert.equal(permissionAllowedByRoleForTest("gestor", "team:invite"), true);
    assert.equal(permissionAllowedByRoleForTest("funcionario", "team:invite"), false);
    assert.equal(permissionAllowedByRoleForTest("funcionario", "whatsapp:send"), false);
    assert.equal(permissionAllowedByRoleForTest("funcionario", "ia:copilot"), false);
    assert.equal(permissionAllowedByRoleForTest("gestor", "whatsapp:send"), true);
    assert.equal(permissionAllowedByRoleForTest("gestor", "ia:copilot"), true);
  });

  it("recepção agenda e WhatsApp; sem financeiro, Copiloto e convite", () => {
    assert.equal(permissionAllowedByRoleForTest("recepcao", "agenda:manage"), true);
    assert.equal(permissionAllowedByRoleForTest("recepcao", "clientes:manage"), true);
    assert.equal(permissionAllowedByRoleForTest("recepcao", "whatsapp:send"), true);
    assert.equal(permissionAllowedByRoleForTest("recepção", "whatsapp:send"), true);
    assert.equal(permissionAllowedByRoleForTest("recepcao", "financeiro:view"), false);
    assert.equal(permissionAllowedByRoleForTest("recepcao", "ia:copilot"), false);
    assert.equal(permissionAllowedByRoleForTest("recepcao", "ia:assist"), false);
    assert.equal(permissionAllowedByRoleForTest("recepcao", "team:invite"), false);
    assert.equal(permissionAllowedByRoleForTest("recepcao", "procedimentos:view"), false);
  });

  it("profissional clínica e IA auxiliar; sem financeiro, Copiloto e WhatsApp API", () => {
    assert.equal(permissionAllowedByRoleForTest("profissional", "clientes:edit"), true);
    assert.equal(permissionAllowedByRoleForTest("profissional", "ia:assist"), true);
    assert.equal(permissionAllowedByRoleForTest("profissional", "planos:view"), true);
    assert.equal(permissionAllowedByRoleForTest("profissional", "procedimentos:view"), true);
    assert.equal(permissionAllowedByRoleForTest("profissional", "financeiro:view"), false);
    assert.equal(permissionAllowedByRoleForTest("profissional", "ia:copilot"), false);
    assert.equal(permissionAllowedByRoleForTest("profissional", "whatsapp:send"), false);
    assert.equal(permissionAllowedByRoleForTest("profissional", "team:invite"), false);
    assert.equal(permissionAllowedByRoleForTest("profissional", "clientes:manage"), false);
  });

  it("cron sem CRON_SECRET não autoriza", () => {
    const prev = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    assert.equal(isCronAuthorized({ headers: { authorization: "Bearer x" } }), false);
    if (prev != null) process.env.CRON_SECRET = prev;
  });
});

describe("P0-01 JWT (se env Supabase existir)", () => {
  it("TESTE 1: authenticateRequest sem Authorization → 401", async () => {
    await assert.rejects(
      () => authenticateRequest({ headers: {}, body: {}, query: {} }),
      (err) => err instanceof ApiAuthError && err.status === 401
    );
  });

  it("TESTE 2: JWT inválido → 401 (ou 500 se ANON não configurado)", async () => {
    try {
      await authenticateRequest({
        headers: { authorization: "Bearer token-invalido" },
        body: {},
        query: {},
      });
      assert.fail("deveria rejeitar");
    } catch (err) {
      assert.ok(err instanceof ApiAuthError);
      assert.ok(err.status === 401 || err.status === 500);
    }
  });
});

describe("P0-01 webhook", () => {
  it("TESTE 13: webhook sem secret configurado → 401", async () => {
    const prev = process.env.WEBHOOK_TRANSACTIONS_SECRET;
    delete process.env.WEBHOOK_TRANSACTIONS_SECRET;
    const res = mockRes();
    await webhookHandler(
      { method: "POST", headers: {}, body: { account_id: "x", transactions: [{ date: "2026-01-01", amount: 1 }] } },
      res
    );
    assert.equal(res.statusCode, 401);
    assert.equal(res.body?.error, "Não autenticado");
    if (prev != null) process.env.WEBHOOK_TRANSACTIONS_SECRET = prev;
    else delete process.env.WEBHOOK_TRANSACTIONS_SECRET;
  });

  it("TESTE 13b: secret configurado mas header errado → 401", async () => {
    const prev = process.env.WEBHOOK_TRANSACTIONS_SECRET;
    process.env.WEBHOOK_TRANSACTIONS_SECRET = "segredo-teste-p001";
    const res = mockRes();
    await webhookHandler(
      {
        method: "POST",
        headers: { "x-webhook-secret": "errado" },
        body: { account_id: "x", transactions: [{ date: "2026-01-01", amount: 1 }] },
      },
      res
    );
    assert.equal(res.statusCode, 401);
    if (prev != null) process.env.WEBHOOK_TRANSACTIONS_SECRET = prev;
    else delete process.env.WEBHOOK_TRANSACTIONS_SECRET;
  });
});

describe("P1 OAuth state assinado", () => {
  const secret = "teste-oauth-state-secret";

  it("aceita state válido", () => {
    const state = createSignedOAuthState({ userId: "u-a", orgId: "org-a" }, secret);
    const claims = verifySignedOAuthState(state, secret);
    assert.equal(claims.userId, "u-a");
    assert.equal(claims.orgId, "org-a");
  });

  it("rejeita state sem assinatura (formato antigo)", () => {
    const unsigned = Buffer.from(JSON.stringify({ userId: "u-b", orgId: "org-b" }), "utf8").toString("base64url");
    assert.equal(verifySignedOAuthState(unsigned, secret), null);
  });

  it("rejeita userId/orgId forjados", () => {
    const state = createSignedOAuthState({ userId: "u-a", orgId: "org-a" }, secret);
    const [payloadB64] = state.split(".");
    const tampered = Buffer.from(JSON.stringify({ userId: "u-hacker", orgId: "org-b", exp: Date.now() + 99999, n: "x" }), "utf8").toString("base64url");
    const [, sig] = state.split(".");
    assert.equal(verifySignedOAuthState(`${tampered}.${sig}`, secret), null);
    assert.equal(verifySignedOAuthState(`${payloadB64}.assinatura-falsa`, secret), null);
  });

  it("rejeita secret diferente", () => {
    const state = createSignedOAuthState({ userId: "u-a", orgId: "org-a" }, secret);
    assert.equal(verifySignedOAuthState(state, "outro-secret"), null);
  });
});

describe("P0 fail-closed e CORS", () => {
  it("consulta de permission com erro → 500, não cai na role", () => {
    assert.throws(
      () => applyPermissionDecision(null, { message: "db down" }, "gestor", "financeiro:view"),
      (err) => err instanceof ApiAuthError && err.status === 500
    );
  });

  it("isMissingPermissionCatalog reconhece PGRST205", () => {
    assert.equal(isMissingPermissionCatalog({ code: "PGRST205", message: "schema cache" }), true);
    assert.equal(isMissingPermissionCatalog({ code: "42P01" }), true);
    assert.equal(isMissingPermissionCatalog({ code: "42501", message: "permission denied" }), false);
  });

  it("isDeployedRuntime: Vercel production", () => {
    const prev = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "production";
    assert.equal(isDeployedRuntime(), true);
    if (prev == null) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prev;
  });

  it("DENY override → 403 mesmo para gestor", () => {
    assert.throws(
      () => applyPermissionDecision({ allowed: false }, null, "gestor", "financeiro:view"),
      (err) => err instanceof ApiAuthError && err.status === 403
    );
  });

  it("ALLOW override → true mesmo se role não tiver a perm", () => {
    assert.equal(applyPermissionDecision({ allowed: true }, null, "funcionario", "financeiro:view"), true);
  });

  it("secretsEqual aceita iguais e rejeita diferentes", () => {
    assert.equal(secretsEqual("abc", "abc"), true);
    assert.equal(secretsEqual("abc", "abd"), false);
  });

  it("CORS não ecoa origin arbitrário", () => {
    assert.equal(corsOriginFor("https://evil.example"), null);
    assert.equal(corsOriginFor("https://skinclinic-one.vercel.app"), "https://skinclinic-one.vercel.app");
  });

  it("não serve routes/, lib/, .env nem google-key.json", () => {
    assert.equal(isBlockedStaticPath("/routes/copiloto.js"), true);
    assert.equal(isBlockedStaticPath("/lib/api-auth.js"), true);
    assert.equal(isBlockedStaticPath("/ai/core/index.js"), true);
    assert.equal(isBlockedStaticPath("/vercel.json"), true);
    assert.equal(isBlockedStaticPath("/.env"), true);
    assert.equal(isBlockedStaticPath("/google-key.json"), true);
    assert.equal(isBlockedStaticPath("/js/core/auth.js"), false);
  });

  it("HTML da SPA não vai para cache; API continua cacheável pelo cliente", () => {
    assert.equal(shouldNoStoreHtml("/dashboard.html"), true);
    assert.equal(shouldNoStoreHtml("/"), true);
    assert.equal(shouldNoStoreHtml("/api/health"), false);
    const vercel = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "vercel.json"), "utf8");
    assert.match(vercel, /X-Frame-Options/);
    assert.match(vercel, /no-store/);
  });

  it("tabela de permissão ausente não é fail-closed 500", () => {
    assert.equal(isMissingPermissionCatalog({ code: "42P01", message: "relation does not exist" }), true);
    assert.equal(isMissingPermissionCatalog({ code: "PGRST205", message: "Could not find the table" }), true);
    assert.equal(isMissingPermissionCatalog({ message: "db down" }), false);
  });
});
