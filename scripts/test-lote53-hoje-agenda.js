/**
 * Lote 53 — Hoje abre o horário na Agenda (ação, não só contagem).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 53 Hoje → Agenda", () => {
  it("clique no agendamento de hoje abre o painel na Agenda", () => {
    const dash = readFileSync(join(ROOT, "js/views/dashboard.views.js"), "utf8");
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(dash, /data-agenda-id/);
    assert.match(dash, /agendaOpenSlotId/);
    assert.match(dash, /navigate\("agenda"\)/);
    assert.match(agenda, /agendaOpenSlotId/);
    assert.match(agenda, /openSlotPanel/);
    assert.match(agenda, /proximaAcaoDoHorario/);
    assert.match(agenda, /agenda-panel__proxima/);
    assert.doesNotMatch(dash, /sendWhatsapp/);
  });

  it("cards globais do header continuam escondidos", () => {
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(html, /id="dashboardStatsGrid"[^>]*hidden/);
  });
});
