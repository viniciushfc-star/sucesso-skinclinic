/**
 * Leftover pós-baixa: próxima sessão, pacote, combinado e anamnese
 * não morrem em coluna extra do schema live.
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

describe("agenda, pacote, eventos e anamnese", () => {
  it("insert da agenda tira coluna desconhecida em vez de um fallback fixo", () => {
    const agenda = src("js/views/agenda.views.js");
    assert.match(agenda, /retryUnknownColumns/);
    assert.match(agenda, /oferecerProximaSessaoAposBaixa/);
    assert.doesNotMatch(agenda, /\/plano_id\|sessao_plano\|sessoes_plano\/i/);
  });

  it("pacote, combinado e anamnese usam o mesmo retry", () => {
    assert.match(src("js/services/pacotes.service.js"), /retryUnknownColumns/);
    assert.match(src("js/services/client-events.service.js"), /retryUnknownColumns/);
    assert.match(src("js/services/anamnesis.service.js"), /retryUnknownColumns/);
    assert.match(src("js/services/anamnesis.service.js"), /Cria um novo registro evolutivo/);
  });

  it("SQL leftover de consumo e metadata existe", () => {
    const sql = src("supabase/supabase-fase0-agenda-pacote-eventos-colar.sql");
    assert.match(sql, /package_consumptions/);
    assert.match(sql, /metadata jsonb/);
    assert.doesNotMatch(sql, /service_role/);
  });
});
