/**
 * P2-9 — Market Radar só com fonte completa.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compararPreco,
  copyComparacao,
  isFonteCompleta,
} from "../js/utils/market-radar.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const base = {
  procedimento: "Limpeza",
  regiao: "SP",
  fonte: "pesquisa própria",
  data_ref: "2026-09-01",
  metodologia: "ligação",
  confianca: "media",
  amostra: 8,
  preco_min: 200,
  preco_max: 350,
};

describe("P2-9 Market Radar", () => {
  it("sem fonte não é completo", () => {
    assert.equal(isFonteCompleta({ ...base, fonte: "" }), false);
    assert.equal(isFonteCompleta(base), true);
  });

  it("copy não manda cobrar um preço", () => {
    const c = compararPreco(400, 200, 350);
    assert.equal(c.posicao, "acima");
    const t = copyComparacao({ posicao: c.posicao, fonte: "pesquisa", regiao: "SP", dataRef: "2026-09-01" });
    assert.match(t, /acima da referência observada/);
    assert.doesNotMatch(t, /cobre/i);
  });

  it("copiloto não mistura radar", () => {
    const cop = readFileSync(join(root, "js/views/copiloto.views.js"), "utf8");
    assert.doesNotMatch(cop, /market-radar/);
    const view = readFileSync(join(root, "js/views/market-radar.views.js"), "utf8");
    assert.match(view, /isFonteCompleta/);
  });
});
