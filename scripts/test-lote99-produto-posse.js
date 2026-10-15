/**
 * Lote 99 — produto da clínica vs representação de marca.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePosse, eRepresentacao, labelPosse } from "../js/utils/produto-posse.js";
import { htmlPropostaOrcamento, formatOrcamentoMensagem } from "../js/utils/orcamento.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function src(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Lote 99 clínica vs representação", () => {
  it("normaliza posse e separa na proposta", () => {
    assert.equal(normalizePosse("Representação"), "representacao");
    assert.equal(eRepresentacao("clinica"), false);
    assert.equal(labelPosse("representacao"), "Representação");
    const items = [
      { kind: "produto", name: "Sérum casa", qty: 1, unit_price: 100, posse: "clinica" },
      { kind: "produto", name: "Sérum marca", qty: 1, unit_price: 80, posse: "representacao", marca_representada: "Lab X" },
    ];
    const html = htmlPropostaOrcamento({ nomeCliente: "Ana", items });
    assert.match(html, /Produto da clínica/);
    assert.match(html, /Representação · Lab X/);
    const msg = formatOrcamentoMensagem({ nomeCliente: "Ana", items });
    assert.match(msg, /Produtos da clínica/);
    assert.match(msg, /Representação/);
    assert.doesNotMatch(msg, /capital/i);
  });

  it("cadastro, filtro e SQL colar existem", () => {
    assert.match(src("js/views/estoque.views.js"), /estoqueCatPosse/);
    assert.match(src("js/views/estoque.views.js"), /data-estoque-posse/);
    assert.match(src("dashboard.html"), /data-estoque-posse-filtro="representacao"/);
    assert.match(src("js/services/estoque-produtos.service.js"), /marca_representada/);
    const sql = src("supabase/supabase-produto-posse-colar.sql");
    assert.match(sql, /posse/);
    assert.doesNotMatch(sql, /DROP TABLE/i);
    assert.match(src("js/core/spa.js"), /mapa-clinico-1/);
  });
});
