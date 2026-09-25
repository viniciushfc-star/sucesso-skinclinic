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

  it("FASE 4 congela identidade e tira UPDATE autenticado", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20260923030000_p0_audit_logs_immutable.sql"),
      "utf8"
    );
    assert.match(sql, /REVOKE UPDATE ON TABLE public.audit_logs FROM authenticated/);
    assert.match(sql, /audit_logs identity is immutable/);
    assert.match(sql, /DROP POLICY IF EXISTS "audit_logs_insert_org"/);
    const views = readFileSync(join(ROOT, "js/views/logs.views.js"), "utf8");
    assert.match(views, /op: "acknowledge"/);
    assert.match(views, /op: "star"/);
    assert.doesNotMatch(views, /\.from\("audit_logs"\)\.update/);
    const route = readFileSync(join(ROOT, "routes/audit-log.js"), "utf8");
    assert.match(route, /sanitizeMetadata/);
    assert.match(route, /delete metadata\.user_id/);
    assert.match(route, /auditoria:acknowledge/);
    assert.match(route, /user_id: auth\.user\.id/);
    assert.doesNotMatch(route, /user_id:\s*req\.body/);
  });

  it("FASE 5 hash do token usa pgcrypto em extensions", () => {
    const sql = readFileSync(join(ROOT, "supabase/migrations/20260925080000_p0_portal_pgcrypto.sql"), "utf8");
    assert.match(sql, /CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions/);
    assert.match(sql, /extensions\.digest\(convert_to\(p_token, 'UTF8'\), 'sha256'::text\)/);
    assert.match(sql, /UPDATE public.client_sessions s/);
    assert.match(sql, /#variable_conflict use_column/);
  });

  it("FASE 5 oculta CPF após cadastro e não grava notes internas", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20260923040000_p1_portal_rpc_cpf.sql"),
      "utf8"
    );
    assert.match(sql, /CASE WHEN c\.registration_completed_at IS NULL THEN c\.cpf ELSE NULL END/);
    assert.doesNotMatch(sql, /c\.notes/);
    assert.doesNotMatch(sql, /notes = nullif\(trim\(p_notes\)/);
    assert.match(sql, /p_notes é ignorado/);
    const src = readFileSync(join(ROOT, "js/Client/completar-cadastro.client.js"), "utf8");
    assert.doesNotMatch(src, /client\.notes/);
    const svc = readFileSync(join(ROOT, "js/Client/client-portal.service.js"), "utf8");
    assert.match(svc, /p_notes:\s*null/);
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
