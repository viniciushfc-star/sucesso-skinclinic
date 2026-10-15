/**
 * Lote 96 — Hoje calmo: uma frase e o próximo passo, sem relatório zerado.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { diaCalmoHoje, montarReuniaoHoje } from "../js/utils/reuniao-hoje.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 96 Hoje calmo", () => {
  it("dia sem horário não puxa lucro/hora do cadastro", () => {
    assert.equal(diaCalmoHoje({}), true);
    assert.equal(diaCalmoHoje({ hojeCount: 2 }), false);
    const r = montarReuniaoHoje({ hojeCount: 0, espera: 0 });
    assert.equal(r.modo, "calmo");
    assert.match(r.lead, /Não tem ninguém na agenda/);
    assert.equal(r.proximo.view, "agenda");
    assert.equal(r.fila.view, "crm");
    const espera = montarReuniaoHoje({ hojeCount: 0, espera: 3 });
    assert.match(espera.lead, /espera/);
  });

  it("tela esconde zeros e reunião de catálogo no dia vazio", () => {
    const view = readFileSync(join(ROOT, "js/views/dashboard.views.js"), "utf8");
    assert.match(view, /cockpit-dia-calmo/);
    assert.match(view, /Marcar horário/);
    assert.match(view, /Ver a fila/);
    assert.match(view, /r\.modo === "calmo"/);
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(html, /O próximo passo do dia/);
    assert.doesNotMatch(html, /Os elos conversam/);
    const css = readFileSync(join(ROOT, "js/css/style.css"), "utf8");
    assert.match(css, /cockpit-dia-calmo \.cockpit-more/);
    const spa = readFileSync(join(ROOT, "js/core/spa.js"), "utf8");
    assert.match(spa, /mapa-clinico-1/);
  });
});
