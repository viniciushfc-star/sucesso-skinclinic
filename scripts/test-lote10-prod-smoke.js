/**
 * Lote 10 — smoke em produção (sem login de clínica).
 * Confere que o host está de pé, páginas do ciclo abrem, APIs falham fechado sem JWT.
 * Login autenticado: só se QA_RUN_AUTH=1 e QA_EMAIL_* no .env (não faz parte deste arquivo).
 *
 *   node --test scripts/test-lote10-prod-smoke.js
 *   QA_BASE_URL=https://skinclinic-one.vercel.app
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GOLDEN_CYCLE } from "../js/utils/golden-flow.js";
import { PAGAMENTO_APP_ENABLED } from "../js/core/feature-flags.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = String(process.env.QA_BASE_URL || "https://skinclinic-one.vercel.app").replace(/\/$/, "");
const SKIP = process.env.LOTE10_SKIP_LIVE === "1";

async function hit(path, { method = "GET", json, timeoutMs = 20000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = {};
    let body;
    if (json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(json);
    }
    const res = await fetch(BASE + path, { method, headers, body, redirect: "manual", signal: ctrl.signal });
    const text = await res.text().catch(() => "");
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    return { status: res.status, text, data };
  } finally {
    clearTimeout(t);
  }
}

describe("Lote 10 smoke produção", { skip: SKIP }, () => {
  it("health público responde ok", async () => {
    const r = await hit("/api/health");
    assert.equal(r.status, 200, `health ${r.status} ${r.text.slice(0, 80)}`);
    assert.equal(r.data?.ok, true);
  });

  it("páginas do ciclo ouro abrem (HTML)", async () => {
    const pages = ["/index.html", "/dashboard.html", "/portal.html", "/agendar.html"];
    for (const p of pages) {
      const r = await hit(p);
      assert.ok(r.status === 200 || r.status === 304, `${p} → ${r.status}`);
      assert.match(r.text, /<html/i);
    }
  });

  it("dashboard traz as views do ciclo (paciente → CRM)", async () => {
    const r = await hit("/dashboard.html");
    assert.equal(r.status, 200);
    assert.match(r.text, /id="view-agenda"/);
    assert.match(r.text, /id="view-clientes"/);
    assert.match(r.text, /id="view-crm"/);
    assert.match(r.text, /id="view-financeiro"/);
    assert.equal(GOLDEN_CYCLE.length, 11);
  });

  it("APIs sensíveis recusam anônimo (401/403/405)", async () => {
    const probes = [
      { path: "/api/whatsapp-send", method: "POST", json: {} },
      { path: "/api/create-portal-session", method: "POST", json: {} },
      { path: "/api/audit-log", method: "POST", json: {} },
      { path: "/api/google-calendar/occupy", method: "POST", json: {} },
      { path: "/api/google-calendar/status", method: "GET" },
      { path: "/api/analise-pele-portal-list", method: "POST", json: {} },
      { path: "/api/copiloto", method: "POST", json: { messages: [] } },
    ];
    for (const p of probes) {
      const r = await hit(p.path, { method: p.method, json: p.json });
      assert.ok(
        [401, 403, 405].includes(r.status),
        `${p.method} ${p.path} → ${r.status} (queria 401/403/405)`
      );
      assert.ok(r.status < 500, `${p.path} não pode 5xx anônimo`);
    }
  });

  it("portal sem token não devolve análise; pagamento no app continua off", async () => {
    const r = await hit("/api/analise-pele", { method: "POST", json: {} });
    assert.ok([400, 401].includes(r.status), `analise-pele ${r.status}`);
    assert.equal("ia_preliminar" in (r.data || {}), false);
    assert.equal(PAGAMENTO_APP_ENABLED, false);
    const flags = await hit("/js/core/feature-flags.js");
    assert.ok(flags.status === 200 || flags.status === 304, `flags ${flags.status}`);
    assert.match(flags.text, /PAGAMENTO_APP_ENABLED\s*=\s*false/);
  });

  it("ciclo ouro ainda está no repo (sem login, só regressão de elos)", () => {
    const dash = readFileSync(join(ROOT, "js/views/dashboard.views.js"), "utf8");
    assert.match(dash, /getCockpitSnapshot/);
    assert.doesNotMatch(dash, /sendWhatsapp/);
  });
});
