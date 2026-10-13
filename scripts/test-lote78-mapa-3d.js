/**
 * Lote 78 — mapa 3D na tela, folha 2D na impressão. Pontos em %; sem gravar sozinho.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cssTransformMapa2dImpressao,
  cssTransformMapa3d,
  MAPA_3D_SCALE_MAX,
} from "../js/utils/mapa-3d.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 78 mapa 3D e impressão 2D", () => {
  it("órbita e zoom na tela; impressão zera o 3D", () => {
    const t = cssTransformMapa3d({ rotY: -14, rotX: 6, scale: 2.2, ox: 40, oy: 30 });
    assert.match(t.transform, /rotateY\(-14deg\)/);
    assert.match(t.transform, /scale\(2\.2\)/);
    assert.equal(t.transformOrigin, "40% 30%");
    assert.equal(t.flattened, false);
    const cap = cssTransformMapa3d({ scale: 99, rotY: 400 });
    assert.equal(cap.scale, MAPA_3D_SCALE_MAX);
    const flat = cssTransformMapa2dImpressao();
    assert.equal(flat.transform, "none");
    assert.equal(flat.flattened, true);
    assert.equal(flat.rotY, 0);
  });

  it("anamnese e ficha ligam o viewer; imprimir 2D; pontos ainda em x_pct", () => {
    const ana = readFileSync(join(ROOT, "js/views/anamnese.views.js"), "utf8");
    assert.match(ana, /bindMapa3d/);
    assert.match(ana, /htmlToolbarMapa3d/);
    assert.match(ana, /Imprimir achata em 2D/);
    assert.match(ana, /x_pct/);
    const perfil = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(perfil, /bindMapa3d/);
    assert.match(perfil, /htmlToolbarMapa3d/);
    assert.match(perfil, /zoomTo/);
    const util = readFileSync(join(ROOT, "js/utils/mapa-3d.js"), "utf8");
    assert.match(util, /window\.print/);
    assert.match(util, /matchMedia\("print"\)/);
    assert.match(util, /mapa-print-sheet/);
    assert.doesNotMatch(util, /from ["']three/);
  });
});
