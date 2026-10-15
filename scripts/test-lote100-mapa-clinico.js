/**
 * Lote 100 — mapa de injetáveis com traço de carta clínica, sem cartoon.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FACE_SVG, FACE_TQ_SVG, FACE_PROFILE_SVG, BARRIGA_SVG, BODY_BACK_SVG, GLUTEOS_SVG, svgDoMapa, vistasDoMapa, vistaDoPonto } from "../js/utils/injetaveis-mapas.js";

describe("Lote 100 mapa clínico", () => {
  it("rosto e corpo usam carta anatômica, não lábio rosa nem oval único", () => {
    assert.match(FACE_SVG, /scFaceSkin/);
    assert.match(FACE_SVG, /rosto-frente\.jpg/);
    assert.match(FACE_SVG, /Testa/);
    assert.match(FACE_SVG, /viewBox="0 0 200 230"/);
    assert.doesNotMatch(FACE_SVG, /#c97b7b/);
    assert.doesNotMatch(FACE_SVG, /<ellipse cx="100" cy="108"/);
    assert.match(BARRIGA_SVG, /scBodySkin/);
    assert.match(BARRIGA_SVG, /Abdômen/);
    assert.match(GLUTEOS_SVG, /scGluteSkin/);
    assert.match(GLUTEOS_SVG, /Superior E/);
  });

  it("frente, 3/4 e perfil no rosto; costas no corpo; ponto antigo fica na frente", () => {
    assert.match(FACE_TQ_SVG, /scFaceTqSkin/);
    assert.match(FACE_PROFILE_SVG, /scFaceProfSkin/);
    assert.match(BODY_BACK_SVG, /scBodyBackSkin/);
    assert.equal(vistasDoMapa("rosto").map((v) => v.id).join(","), "frente,tres_quartos,perfil");
    assert.equal(svgDoMapa("rosto", "perfil"), FACE_PROFILE_SVG);
    assert.equal(svgDoMapa("barriga", "costas"), BODY_BACK_SVG);
    assert.equal(vistaDoPonto({ mapa: "rosto", x_pct: 10 }, "rosto"), "frente");
    assert.equal(vistaDoPonto({ mapa: "rosto", vista: "perfil" }, "rosto"), "perfil");
  });
});
