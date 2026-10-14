/**
 * Lote 92 — pares antes/depois na ficha. Humano compara. Sem post automático.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  chaveParFoto,
  paresAntesDepois,
  indicesParPadrao,
  rotuloParEvolucao,
} from "../js/utils/antes-depois.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 92 antes/depois na ficha", () => {
  it("casa pelo procedimento e pela data; soltas ficam de fora", () => {
    assert.equal(chaveParFoto({ procedure_id: "p1" }), "p:p1");
    const { pares, soltas } = paresAntesDepois([
      { id: "a1", type: "antes", taken_at: "2026-01-01", procedure_id: "botox", photo_url: "u1" },
      { id: "d1", type: "depois", taken_at: "2026-02-01", procedure_id: "botox", photo_url: "u2" },
      { id: "a2", type: "antes", taken_at: "2026-03-01", notes: "melasma", photo_url: "u3" },
      { id: "late", type: "depois", taken_at: "2026-01-02", procedure_id: "outro", photo_url: "u4" },
    ]);
    assert.equal(pares.length, 1);
    assert.equal(pares[0].antes.id, "a1");
    assert.equal(pares[0].depois.id, "d1");
    assert.equal(pares[0].intervaloDias, 31);
    assert.equal(soltas.length, 2);
    assert.match(rotuloParEvolucao(pares[0], { botox: "Botox" }), /Botox/);
    const idx = indicesParPadrao(
      [
        { id: "d1", type: "depois" },
        { id: "a1", type: "antes" },
      ],
      pares[0]
    );
    assert.equal(idx.i1, 1);
    assert.equal(idx.i2, 0);
  });

  it("ficha e evolução mostram o par; comparar não publica", () => {
    const view = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(view, /renderParesAntesDepois/);
    assert.match(view, /btnCicloVerEvolucao/);
    assert.match(view, /Não publica em rede/);
    assert.match(view, /Sem post automático/);
    assert.doesNotMatch(view, /view-atendimentos|#atendimentos/);
    const spa = readFileSync(join(ROOT, "js/core/spa.js"), "utf8");
    assert.match(spa, /clinica-ux-1/);
  });
});
