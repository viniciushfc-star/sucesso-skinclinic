/**
 * Lote 54 — P1-6 setup (um CTA + CSV com prévia) e P1-7 radar (um sinal, sem disparo).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SETUP_STEP_IDS, proximoPassoSetup } from "../js/utils/golden-flow.js";
import { classificarSinalRadar } from "../js/utils/crm-fila.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 54 setup e radar", () => {
  it("primeiro dia aponta um passo, não dez botões iguais", () => {
    const steps = SETUP_STEP_IDS.map((id, i) => ({ id, ok: i < 2, view: id, label: id }));
    const next = proximoPassoSetup(steps);
    assert.equal(next.id, "procedimento");
    assert.equal(proximoPassoSetup(steps.map((s) => ({ ...s, ok: true }))), null);
    const dash = readFileSync(join(ROOT, "js/views/dashboard.views.js"), "utf8");
    assert.match(dash, /setup-progress-cta/);
    assert.match(dash, /Checklist/);
    assert.match(dash, /data-view="export"/);
    assert.match(dash, /pct >= 100 && p\.aha/);
  });

  it("CSV exige prévia e não grava na leitura", () => {
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(html, /id="btnImportarLote"[^>]*disabled/);
    const exp = readFileSync(join(ROOT, "js/views/export.views.js"), "utf8");
    const lote = readFileSync(join(ROOT, "js/services/importacao-lote.service.js"), "utf8");
    assert.match(exp, /analisarPreviaImportacao/);
    assert.match(exp, /nada foi gravado ainda/);
    assert.match(lote, /podeImportar: total > 0 && !tooBig && okEstimado > 0/);
    assert.match(exp, /mostrarPreviewOuImportar/);
    assert.match(exp, /confirmarImportacao/);
  });

  it("radar: um sinal, futuro fora, WhatsApp só no clique", () => {
    assert.equal(classificarSinalRadar({ hasFuture: true, idleDays: 90, visits: 5 }).sinal, null);
    assert.equal(classificarSinalRadar({ packRest: 3, idleDays: 10 }).sinal, "pacote");
    assert.equal(classificarSinalRadar({ packEnded: true, packNome: "Limpeza", idleDays: 5 }).sinal, "plano_fim");
    assert.equal(classificarSinalRadar({ packEnded: true, packRest: 2, idleDays: 5 }).sinal, "pacote");
    assert.equal(classificarSinalRadar({ packEnded: true, hasFuture: true }).sinal, null);
    assert.equal(classificarSinalRadar({ visits: 1, idleDays: 20 }).sinal, "nova_sem_2");
    assert.equal(classificarSinalRadar({ visits: 4, idleDays: 40, medianGap: 21 }).sinal, "atrasada");
    assert.equal(classificarSinalRadar({ visits: 2, idleDays: 10, minDaysInativa: 60 }).sinal, "sem_proxima");
    assert.equal(classificarSinalRadar({ visits: 0, idleDays: 80, minDaysInativa: 60 }).sinal, "inativa");
    const crm = readFileSync(join(ROOT, "js/views/crm.views.js"), "utf8");
    assert.match(crm, /agendaPrefillClientId/);
    assert.match(crm, /crm_open_section/);
    assert.doesNotMatch(crm, /sendWhatsapp\([^)]+,\s*true/);
    const spa = readFileSync(join(ROOT, "js/core/spa.js"), "utf8");
    assert.match(spa, /crm_open_section/);
    const dash = readFileSync(join(ROOT, "js/views/dashboard.views.js"), "utf8");
    assert.match(dash, /data-crm-section/);
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(agenda, /agendaPrefillClientId/);
  });
});
