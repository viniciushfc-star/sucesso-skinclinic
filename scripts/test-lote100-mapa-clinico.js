/**
 * Lote 100 — mapa de injetáveis com traço de carta clínica, sem cartoon.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FACE_SVG, BARRIGA_SVG, GLUTEOS_SVG } from "../js/utils/injetaveis-mapas.js";

describe("Lote 100 mapa clínico", () => {
  it("rosto e corpo usam carta anatômica, não lábio rosa nem oval único", () => {
    assert.match(FACE_SVG, /scFaceSkin/);
    assert.match(FACE_SVG, /Testa/);
    assert.match(FACE_SVG, /viewBox="0 0 200 230"/);
    assert.doesNotMatch(FACE_SVG, /#c97b7b/);
    assert.doesNotMatch(FACE_SVG, /<ellipse cx="100" cy="108"/);
    assert.match(BARRIGA_SVG, /scBodySkin/);
    assert.match(BARRIGA_SVG, /Abdômen/);
    assert.match(GLUTEOS_SVG, /scGluteSkin/);
    assert.match(GLUTEOS_SVG, /Superior E/);
  });
});
