/**
 * Lote 97 — Estoque usável: busca, saldo sem ranking, Chegou com duas ações.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function src(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Lote 97 UX do Estoque", () => {
  it("busca e copy de rotina no HTML", () => {
    const html = src("dashboard.html");
    const trecho = html.slice(html.indexOf('id="view-estoque"'), html.indexOf('id="view-ocr"'));
    assert.match(trecho, /id="estoqueBusca"/);
    assert.match(trecho, />Cadastro</);
    assert.match(trecho, />Análise</);
    assert.match(trecho, /<details class="view-card" id="estoqueRevendaCard"/);
    assert.match(trecho, /estoque-entrada-mais/);
    assert.match(trecho, /id="estoqueResumoEmpty"/);
    assert.match(src("js/core/spa.js"), /produto-posse-1/);
  });

  it("filtra por nome e não esconde saldo vazio", () => {
    const js = src("js/views/estoque.views.js");
    assert.match(js, /function filtrarEstoque/);
    assert.match(js, /data-estoque-nome/);
    assert.match(js, /estoqueResumoEmpty/);
    assert.match(js, />Avaliar</);
  });
});
