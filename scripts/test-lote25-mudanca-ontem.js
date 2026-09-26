/**
 * Lote 25 — o que mudou vs ontem no cockpit.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dataOntemIso, linhaVsOntem, linhasMudancaVsOntem } from "../js/utils/mudanca-ontem.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("mudança vs ontem", () => {
  it("compara sem inventar e rotula mais/menos/igual", () => {
    assert.equal(dataOntemIso("2026-09-26"), "2026-09-25");
    const mais = linhaVsOntem("Agendamentos", 8, 5, "qtd");
    assert.equal(mais.direcao, "mais");
    assert.equal(mais.delta, 3);
    const igual = linhaVsOntem("Previsto", 100, 100, "brl");
    assert.equal(igual.direcao, "igual");
    const linhas = linhasMudancaVsOntem({
      agendaHoje: 2,
      agendaOntem: 4,
      previstoHoje: 200,
      previstoOntem: 100,
      entradasHoje: 50,
      entradasOntem: 50,
    });
    assert.equal(linhas[0].direcao, "menos");
    assert.equal(linhas[1].direcao, "mais");
    assert.equal(linhas[2].direcao, "igual");
  });

  it("dashboard mostra o bloco e o cockpit calcula ontem", () => {
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    const view = readFileSync(join(ROOT, "js/views/dashboard.views.js"), "utf8");
    const svc = readFileSync(join(ROOT, "js/services/cockpit.service.js"), "utf8");
    assert.match(html, /cockpitMudancaOntem/);
    assert.match(view, /mudancaOntem/);
    assert.match(svc, /linhasMudancaVsOntem/);
  });
});
