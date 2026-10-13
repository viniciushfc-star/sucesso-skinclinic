/**
 * Lote 65 — piloto: foto na ficha o dia todo; menu não atropela tela.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SIGNED_TTL_MAX, clampSignedTtl } from "../js/utils/rls-prova.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 65 piloto fotos e menu", () => {
  it("link assinado cobre o dia de consultório, não uma hora", () => {
    assert.equal(SIGNED_TTL_MAX, 86400);
    assert.equal(clampSignedTtl(999999), 86400);
    assert.equal(clampSignedTtl(120), 120);
  });

  it("SPA ignora navegação velha e tenta de novo se o módulo falhar", () => {
    const spa = readFileSync(join(ROOT, "js/core/spa.js"), "utf8");
    assert.match(spa, /let navGen = 0/);
    assert.match(spa, /if \(gen !== navGen\) return/);
    assert.match(spa, /function importViewFile/);
    assert.match(spa, /Failed to fetch/);
    assert.match(readFileSync(join(ROOT, "dashboard.html"), "utf8"), /spa\.js\?v=/);
  });
});
