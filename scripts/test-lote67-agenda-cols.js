/**
 * Lote 67 — agenda do dia em colunas por profissional.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 67 agenda colunas por profissional", () => {
  it("com Todas, a grade do dia é uma coluna por profissional", () => {
    const view = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(view, /agenda-week--cols/);
    assert.match(view, /data-user-id/);
    assert.match(view, /professionalId: cell\.dataset.userId/);
    assert.match(view, /Cada coluna é uma profissional/);
    assert.match(view, /function htmlWeekAptBlock/);
    assert.match(view, /profPrimeiroNome\(members, apt\.user_id\)/);
  });

  it("CSS da coluna não usa grade fixa de 6 dias", () => {
    const css = readFileSync(join(ROOT, "js/css/style.css"), "utf8");
    assert.match(css, /\.agenda-week--cols/);
    assert.match(css, /--agenda-cols/);
    assert.match(css, /\.agenda-week-daystrip/);
    assert.match(css, /\.agenda-week-colh/);
    assert.match(readFileSync(join(ROOT, "dashboard.html"), "utf8"), /style\.css\?v=/);
  });
});
