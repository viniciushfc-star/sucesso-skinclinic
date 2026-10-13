/**
 * Leftover: convite de profissional, roster na agenda, comparar fotos.
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

describe("equipe, fotos e convite", () => {
  it("SQL libera role profissional e token no convite", () => {
    const sql = src("supabase/supabase-fase0-equipe-fotos-convite-colar.sql");
    assert.match(sql, /'profissional'/);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS token/);
    assert.match(sql, /org members read roster/);
    assert.match(sql, /client_evolution_photos/);
    assert.doesNotMatch(sql, /service_role/);
  });

  it("agenda não esvazia profissionais se professional_procedures faltar", () => {
    const agenda = src("js/views/agenda.views.js");
    assert.match(agenda, /getProfessionalIdsWhoCanDoProcedure/);
    assert.match(agenda, /catch \(_\) \{\s*profIds = null/);
    const svc = src("js/services/professional-procedures.service.js");
    assert.match(svc, /missingProfProcTable/);
  });

  it("convite, fotos e espera usam retry; comparar tem os dois botões", () => {
    assert.match(src("js/services/invite.service.js"), /retryUnknownColumns/);
    assert.match(src("js/services/evolution-photos.service.js"), /retryUnknownColumns/);
    assert.match(src("js/services/waitlist.service.js"), /missingWaitlistTable/);
    const perfil = src("js/views/cliente-perfil.views.js");
    assert.match(perfil, /btnCompararFotos/);
    assert.match(perfil, /btnCompararFotosEvolucao/);
    assert.match(perfil, /openCompararFotosModal/);
  });
});
