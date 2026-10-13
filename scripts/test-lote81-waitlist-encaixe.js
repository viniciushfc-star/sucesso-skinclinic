/**
 * Lote 81 — lista de espera pede SQL colar; cancelar sugere encaixe sem WhatsApp sozinho.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { htmlHintWaitlistSql, matchWaitlistToSlot } from "../js/utils/espera-encaixe.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function src(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Lote 81 waitlist colar e encaixe", () => {
  it("SQL colar cria agenda_waitlist com RLS da org", () => {
    const sql = src("supabase/supabase-fase0-waitlist-colar.sql");
    assert.match(src("js/services/waitlist.service.js"), /SQL_WAITLIST = "supabase-fase0-waitlist-colar.sql"/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.agenda_waitlist/);
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /organization_users/);
    assert.doesNotMatch(sql, /service_role/);
    assert.match(htmlHintWaitlistSql(), /supabase-fase0-waitlist-colar/);
  });

  it("serviço não esconde tabela ausente; CRM e agenda apontam o colar", () => {
    const svc = src("js/services/waitlist.service.js");
    assert.match(svc, /SQL_AUSENTE/);
    assert.match(svc, /missingWaitlistTable/);
    assert.doesNotMatch(svc, /if \(missingWaitlistTable\(error\)\) return \[\]/);
    const crm = src("js/views/crm.views.js");
    assert.match(crm, /htmlHintWaitlistSql/);
    assert.match(crm, /agendaPrefillWaitlistId/);
    assert.match(crm, /crm-agendar/);
    const html = src("dashboard.html");
    assert.match(html, /supabase-fase0-waitlist-colar/);
    assert.doesNotMatch(html, /Precisa do SQL supabase-crm-waitlist/);
  });

  it("cancelar horário oferece Encaixar e não dispara WhatsApp", () => {
    const agenda = src("js/views/agenda.views.js");
    assert.match(agenda, /agenda-espera-encaixar-vaga/);
    assert.match(agenda, /agendaWaitlistId/);
    assert.match(agenda, /updateWaitlistStatus\(waitlistId, "encaixada"\)/);
    assert.match(agenda, /hideSubmit: true/);
    assert.doesNotMatch(agenda, /sendWhatsapp\([^)]*espera[^)]*releaseAppointment/);
    const hit = matchWaitlistToSlot(
      [{ id: "1", nome: "Ana", status: "aberta", preferred_date: "2026-10-13", procedure_name: "Botox" }],
      { data: "2026-10-13", procedimento: "Botox" }
    );
    assert.equal(hit[0].id, "1");
  });
});
