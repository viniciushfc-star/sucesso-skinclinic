/**
 * P2-8 — OCR/XML sugerem itens; humano confere.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeParsedNota, parseNfeXml } from "../js/utils/ocr-nota.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("P2-8 import IA / XML", () => {
  it("normaliza e descarta item sem nome", () => {
    const n = normalizeParsedNota({
      fornecedor: "  Lab  ",
      data: "2026-09-21",
      itens: [{ produto_nome: "", quantidade: 2 }, { produto_nome: "Ácido", quantidade: "2,5" }],
    });
    assert.equal(n.itens.length, 1);
    assert.equal(n.itens[0].quantidade, 2.5);
    assert.equal(n.fornecedor, "Lab");
  });

  it("XML NF-e extrai produto e não inventa outro", () => {
    const xml = `<?xml version="1.0"?><NFe><infNFe><ide><dhEmi>2026-09-21T10:00:00-03:00</dhEmi></ide>
      <emit><xNome>Fornecedor X</xNome></emit>
      <det nItem="1"><prod><xProd>Toxina 100U</xProd><qCom>2.0000</qCom><vUnCom>150.00</vUnCom><vProd>300.00</vProd></prod></det>
      </infNFe></NFe>`;
    const n = parseNfeXml(xml);
    assert.equal(n.fornecedor, "Fornecedor X");
    assert.equal(n.data, "2026-09-21");
    assert.equal(n.itens.length, 1);
    assert.equal(n.itens[0].produto_nome, "Toxina 100U");
    assert.equal(n.itens[0].quantidade, 2);
  });

  it("estoque grava ocr_nota_id e XML não está mais em breve", () => {
    const src = readFileSync(join(root, "js/views/estoque.views.js"), "utf8");
    assert.match(src, /ocr_nota_id/);
    assert.match(src, /openEntradaXml/);
    assert.match(src, /openColarTextoNota/);
    assert.doesNotMatch(src, /em breve/i);
  });
});
