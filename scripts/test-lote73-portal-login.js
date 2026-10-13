/**
 * Lote 73 — login da paciente no portal, separado da equipe; link continua.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emailPortalNorm, senhaPortalOk } from "../js/utils/portal-login.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 73 login da paciente", () => {
  it("e-mail normaliza; senha mínima sem espaço", () => {
    assert.equal(emailPortalNorm("  Ana@Ex.com "), "ana@ex.com");
    assert.equal(senhaPortalOk("1234567"), false);
    assert.equal(senhaPortalOk("12345678"), true);
    assert.equal(senhaPortalOk("1234 5678"), false);
  });

  it("portal entra por senha ou token; não usa Auth da equipe", () => {
    const boot = readFileSync(join(ROOT, "js/Client/portal.js"), "utf8");
    assert.match(boot, /showPortalLogin/);
    assert.match(boot, /loginClientPortal/);
    assert.match(boot, /params\.get\("token"\)/);
    assert.doesNotMatch(boot, /signInWithPassword/);
    assert.doesNotMatch(boot, /dashboard\.html/);
    const cad = readFileSync(join(ROOT, "js/Client/completar-cadastro.client.js"), "utf8");
    assert.match(cad, /id="regSenha"/);
    assert.match(cad, /setClientPortalPassword/);
    const svc = readFileSync(join(ROOT, "js/Client/client-portal.service.js"), "utf8");
    assert.match(svc, /login_client_portal/);
    assert.match(svc, /set_client_portal_password/);
    assert.doesNotMatch(svc, /signInWithPassword/);
    const sql = readFileSync(join(ROOT, "supabase/supabase-fase0-portal-login-colar.sql"), "utf8");
    assert.match(sql, /client_portal_logins/);
    assert.match(sql, /extensions\.crypt/);
    assert.doesNotMatch(sql, /auth\.users/);
    const html = readFileSync(join(ROOT, "portal.html"), "utf8");
    assert.match(html, /portal\.js\?v=portal-login-1/);
  });
});
