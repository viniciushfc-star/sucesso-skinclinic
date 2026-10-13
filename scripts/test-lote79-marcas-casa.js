/**
 * Lote 79 — rotina de pele com marcas da casa. Sem ranking de mercado.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  agruparMarcasCasa,
  filtrarMarcasSelecionadas,
  inferirMarca,
  payloadMarcasParaIa,
} from "../js/utils/marcas-casa.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 79 marcas da casa na rotina", () => {
  it("agrupa portfólio por marca inferida do nome", () => {
    const grupos = agruparMarcasCasa([
      { id: "1", nome: "La Roche-Posay Effaclar" },
      { id: "2", nome: "La Roche-Posay Cicaplast" },
      { id: "3", nome: "ISDIN — Fusion Water" },
    ]);
    assert.equal(inferirMarca({ nome: "ISDIN — Fusion Water" }), "ISDIN");
    assert.equal(inferirMarca({ nome: "La Roche-Posay Effaclar" }), "La Roche-Posay");
    assert.ok(grupos.some((g) => g.marca === "La Roche-Posay"));
    const isdin = grupos.find((g) => g.marca === "ISDIN");
    assert.equal(isdin.produtos.length, 1);
    const soIsdin = filtrarMarcasSelecionadas(grupos, ["ISDIN"]);
    assert.equal(soIsdin.length, 1);
    const ia = payloadMarcasParaIa(soIsdin);
    assert.deepEqual(ia.marcas, ["ISDIN"]);
    assert.equal(ia.produtos[0].nome, "ISDIN — Fusion Water");
  });

  it("skincare e análise usam a lista; rota proíbe mercado inventado", () => {
    const view = readFileSync(join(ROOT, "js/views/skincare.views.js"), "utf8");
    assert.match(view, /marcas_casa/);
    assert.match(view, /htmlMarcasCasa/);
    assert.match(view, /listProdutosCatalogo/);
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(html, /id="skincareMarcasCasa"/);
    const ana = readFileSync(join(ROOT, "js/views/analise-pele.views.js"), "utf8");
    assert.match(ana, /btnRotinaMarcasCasa/);
    assert.match(ana, /skincare_from_profile/);
    const rota = readFileSync(join(ROOT, "routes/skincare.js"), "utf8");
    assert.match(rota, /payloadMarcasParaIa/);
    assert.match(rota, /únicos nomes permitidos|SOMENTE produtos\/marcas da casa/);
    assert.match(rota, /melhor do mercado/);
    assert.doesNotMatch(rota, /sendWhatsapp/);
  });
});
