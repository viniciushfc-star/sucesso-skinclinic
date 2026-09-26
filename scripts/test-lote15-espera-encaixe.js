/**
 * Lote 15 — cancelar horário sugere espera; WhatsApp só no clique.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { matchWaitlistToSlot } from "../js/utils/espera-encaixe.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("cancelamento e lista de espera", () => {
  it("prioriza quem pediu o mesmo dia e procedimento", () => {
    const wait = [
      { id: "1", nome: "Ana", status: "aberta", preferred_date: "2026-09-28", procedure_name: "Botox", created_at: "2026-01-01" },
      { id: "2", nome: "Bia", status: "aberta", preferred_date: "2026-09-01", procedure_name: "Limpeza", created_at: "2026-01-02" },
      { id: "3", nome: "Cia", status: "fechada", preferred_date: "2026-09-28", procedure_name: "Botox", created_at: "2026-01-03" },
    ];
    const hit = matchWaitlistToSlot(wait, { data: "2026-09-28", procedimento: "Botox" });
    assert.equal(hit[0].id, "1");
    assert.ok(!hit.some((w) => w.id === "3"));
  });

  it("novo horário também sugere encaixe, WhatsApp só no clique", () => {
    const src = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(src, /preencherEsperaEncaixeNoModal/);
    assert.match(src, /agenda-espera-encaixar/);
    assert.match(src, /Nada foi enviado no WhatsApp/);
    assert.equal((src.match(/origem: "agenda_espera"/g) || []).length >= 1, true);
  });

  it("agenda cancela e não dispara WhatsApp sozinha", () => {
    const src = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(src, /releaseAppointment/);
    assert.match(src, /matchWaitlistToSlot/);
    assert.match(src, /origem: "agenda_espera"/);
    assert.match(src, /agendaPanelBtnCancelar/);
    assert.doesNotMatch(src, /sendWhatsapp\([^)]+agenda_espera[^)]*\)\s*;\s*await releaseAppointment/);
    assert.match(src, /occupyProfessionalCalendar\(item\.id, "release"\)/);
  });
});
