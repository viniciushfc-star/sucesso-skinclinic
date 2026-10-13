/**
 * Leftover: CRM radar, salas e plano não morrem em coluna extra.
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

describe("CRM, salas, plano e skincare", () => {
  it("radar relê agenda se cancelled_at não existir", () => {
    const crm = src("js/services/crm.service.js");
    assert.match(crm, /isUnknownColumnError/);
    assert.match(crm, /cancelled_at/);
    assert.match(crm, /select\("cliente_id, data"\)/);
  });

  it("salas, planos e skincare usam retry e fail-open na lista", () => {
    assert.match(src("js/services/salas.service.js"), /retryUnknownColumns/);
    assert.match(src("js/services/salas.service.js"), /missingSalasTable/);
    assert.match(src("js/services/planos-terapeuticos.service.js"), /missingPlanosTable/);
    assert.match(src("js/services/skincare-rotina.service.js"), /retryUnknownColumns/);
  });

  it("SQL leftover de cancelled_at e skincare existe", () => {
    const sql = src("supabase/supabase-fase0-crm-salas-plano-colar.sql");
    assert.match(sql, /cancelled_at/);
    assert.match(sql, /skincare_rotinas/);
    assert.match(sql, /procedimento_tipos/);
    assert.doesNotMatch(sql, /service_role/);
  });
});
