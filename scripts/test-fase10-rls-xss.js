/**
 * FASE 10/12 — mais tabelas no probe A≠B; conflito da agenda não vira HTML cru.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("FASE 10 RLS e FASE 12 XSS", () => {
  it("probe A≠B cobre logs, LGPD, Google e WhatsApp", () => {
    const src = readFileSync(join(ROOT, "scripts/rls-tenant-ab.js"), "utf8");
    for (const t of [
      "lgpd_requests",
      "api_error_events",
      "agenda_google_events",
      "google_calendar_connections",
      "whatsapp_logs",
      "ai_usage_events",
      "client_events",
      "anamnesis_registros",
    ]) {
      assert.match(src, new RegExp(`"${t}"`));
    }
    assert.match(src, /OPTIONAL_TABLES/);
  });

  it("status de conflito na agenda passa por formatConflitoHtml", () => {
    const src = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(src, /function formatConflitoHtml/);
    assert.equal((src.match(/formatConflitoHtml\(/g) || []).length >= 5, true);
    assert.doesNotMatch(src, /statusEl\.innerHTML = `<strong>Sala ocupada:<\/strong> \$\{c\.procedimento\}/);
    assert.doesNotMatch(src, /conflitoText = `\$\{c\?\.procedimento/);
  });
});
