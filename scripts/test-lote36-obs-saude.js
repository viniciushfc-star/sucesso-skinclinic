/**
 * Lote 36 — P95, falha de login sem e-mail e job visível. Sem inventar amostra.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { p95Ms, resumoLatencia, parseJobMessage, resumoLoginFail } from "../js/utils/obs-saude.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("obs saude p95 login job", () => {
  it("P95 vazio é nulo; com amostra usa o percentil", () => {
    assert.equal(p95Ms([]), null);
    assert.equal(resumoLatencia([]).p95Ms, null);
    assert.match(resumoLatencia([]).texto, /não informado/);
    assert.equal(p95Ms([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]), 100);
    const login = resumoLoginFail({ n: 0 });
    assert.equal(login.n, 0);
    assert.match(login.texto, /e-mail/);
    assert.equal(parseJobMessage("scanned=12 sent=3").sent, 3);
  });

  it("auditoria mostra P95 e job; login fail não manda e-mail; cron grava job_run", () => {
    const view = readFileSync(join(ROOT, "js/views/logs.views.js"), "utf8");
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    const auth = readFileSync(join(ROOT, "js/core/auth.js"), "utf8");
    const cron = readFileSync(join(ROOT, "routes/lembretes-auto.js"), "utf8");
    const route = readFileSync(join(ROOT, "routes/obs-login-fail.js"), "utf8");
    const ops = readFileSync(join(ROOT, "routes/ops-summary.js"), "utf8");
    assert.match(view, /latencia/);
    assert.match(html, /P95 deste isolate/);
    assert.match(auth, /obs-login-fail/);
    assert.doesNotMatch(auth, /obs-login-fail.*email/);
    assert.match(cron, /job_run/);
    assert.match(route, /credencial recusada/);
    assert.doesNotMatch(route, /req\.body/);
    assert.match(ops, /resumoLatencia/);
  });
});
