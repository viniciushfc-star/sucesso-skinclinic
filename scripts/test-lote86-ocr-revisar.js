/**
 * Lote 86 — OCR do caderno/nota sempre passa por Revisar.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rascunhoParaRevisar, podeConfirmarEntrada } from "../js/utils/ocr-revisar.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 86 OCR Revisar", () => {
  it("rascunho fica em revisar e não confirma vazio", () => {
    const r = rascunhoParaRevisar(
      { fornecedor: "Lab", itens: [{ produto_nome: "Ácido", quantidade: 2 }] },
      "caderno linha 1",
      "ocr"
    );
    assert.equal(r.status, "revisar");
    assert.equal(r.itens.length, 1);
    assert.match(r.bruto, /caderno/);
    assert.equal(podeConfirmarEntrada([]), false);
    assert.equal(podeConfirmarEntrada([{ produto_nome: "Ácido", quantidade: 2 }]), true);
  });

  it("estoque abre Revisar antes de gravar", () => {
    const src = readFileSync(join(ROOT, "js/views/estoque.views.js"), "utf8");
    assert.match(src, /openRevisarNota/);
    assert.match(src, /Revisar itens/);
    assert.match(src, /Confirmar entrada/);
    assert.match(src, /nada entra ainda/i);
  });
});
