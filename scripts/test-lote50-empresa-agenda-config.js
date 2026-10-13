/**
 * Leftover: salvar Empresa e config da agenda sem waterfall de colunas.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function src(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("empresa, agenda config e confirmação", () => {
  it("perfil da org tira coluna extra em vez da cascata antiga", () => {
    const svc = src("js/services/organization-profile.service.js");
    assert.match(svc, /retryUnknownColumns/);
    assert.doesNotMatch(svc, /isMissingColumn/);
    assert.doesNotMatch(svc, /isBrindeUpdate/);
  });

  it("agenda_config e confirmação não derrubam a tela se a tabela faltar", () => {
    assert.match(src("js/services/agenda-config.service.js"), /missingAgendaConfig/);
    assert.match(src("js/services/confirmations.service.js"), /retryUnknownColumns/);
  });

  it("SQL leftover de empresa e confirmação existe", () => {
    const sql = src("supabase/supabase-fase0-empresa-agenda-colar.sql");
    assert.match(sql, /google_review_url/);
    assert.match(sql, /agenda_config/);
    assert.match(sql, /appointment_confirmations/);
    assert.doesNotMatch(sql, /service_role/);
  });
});
