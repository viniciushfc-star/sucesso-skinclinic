/**
 * Lote 62 — agenda clínica (tokens teal, menos widget, profissional no bloco).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 62 agenda UX clínica", () => {
  it("grade usa teal do design system, não indigo de template", () => {
    const css = readFileSync(join(ROOT, "js/css/style.css"), "utf8");
    const week = css.slice(css.indexOf(".agenda-week-block{"), css.indexOf(".agenda-week-block b{"));
    assert.match(week, /--sc-teal/);
    assert.doesNotMatch(week, /#1a73e8|#4e54c8|#ece9fa|#3730a3/);
    assert.match(css, /\.agenda-toolbar-create\{[\s\S]*?width:auto/);
    assert.match(css, /\.agenda-google-style \.agenda-calendar-cell--selected\{ background:var\(--sc-teal\)/);
    assert.doesNotMatch(css, /agenda-google-style[^{]*\{[^}]*#1a73e8/);
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(html, /agenda-toolbar-mais/);
    assert.match(html, /<details class="agenda-aniversariantes-wrap"/);
    assert.match(html, /id="btnImportarAgenda"/);
    assert.match(html, /id="btnAgendaListaEspera"/);
  });

  it("bloco da semana mostra profissional quando o filtro é todos", () => {
    const view = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(view, /function profPrimeiroNome/);
    assert.match(view, /profPrimeiroNome\(members, apt\.user_id\)/);
    assert.match(view, /agenda-week-block--retorno/);
    assert.doesNotMatch(view, /view-atendimentos|#atendimentos/);
    assert.match(view, /extByUser/);
    assert.match(view, /htmlWeekOcupado/);
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(html, /agenda-legenda-i--google/);
  });
});
