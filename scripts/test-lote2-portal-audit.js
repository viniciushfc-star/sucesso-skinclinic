/**
 * Lote 2 — PII do portal + auditoria só via API.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 2 portal PII e audit", () => {
  it("RPC get_client_by_token não devolve notes da clínica", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20260922050000_p2_portal_pii_audit.sql"),
      "utf8"
    );
    assert.match(sql, /get_client_by_token\(p_token text\)/);
    assert.doesNotMatch(sql, /c\.notes/);
    assert.match(sql, /c\.cpf/);
    assert.match(sql, /DROP POLICY IF EXISTS "audit_logs_insert_org"/);
    assert.match(sql, /REVOKE INSERT ON TABLE public.audit_logs FROM authenticated/);
  });

  it("staff grava auditoria pela API, não insert direto", () => {
    const svc = readFileSync(join(ROOT, "js/services/audit.service.js"), "utf8");
    const route = readFileSync(join(ROOT, "routes/audit-log.js"), "utf8");
    const server = readFileSync(join(ROOT, "server.js"), "utf8");
    assert.match(svc, /\/api\/audit-log/);
    assert.doesNotMatch(svc, /from\("audit_logs"\)\.insert/);
    assert.match(route, /auth\.orgId/);
    assert.match(route, /auth\.user\.id/);
    assert.match(server, /\/api\/audit-log/);
  });

  it("cadastro do portal não preenche notes internas", () => {
    const src = readFileSync(join(ROOT, "js/Client/completar-cadastro.client.js"), "utf8");
    assert.doesNotMatch(src, /client\.notes/);
  });

  it("rls-ab inclui ocr_notas e market_radar_refs", () => {
    const src = readFileSync(join(ROOT, "scripts/rls-tenant-ab.js"), "utf8");
    assert.match(src, /ocr_notas/);
    assert.match(src, /market_radar_refs/);
    assert.match(src, /api\/audit-log/);
  });
});
