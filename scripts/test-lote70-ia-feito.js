/**
 * Lote 70 — IA junto de “o que foi feito”; humano usa ou descarta; sem gravar sozinha.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  payloadProtocoloIaFicha,
  temFonteParaIa,
  rotuloFonteIa,
} from "../js/utils/protocolo-rascunho-ficha.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 70 IA no o que foi feito", () => {
  it("rótulo cita anamnese e pele validada, nunca preliminar", () => {
    const vazio = payloadProtocoloIaFicha({ anamnese: [], analises: [{ ia_preliminar: "x" }] });
    assert.equal(temFonteParaIa(vazio), false);
    assert.match(rotuloFonteIa(vazio), /Sem fonte validada/);
    assert.doesNotMatch(JSON.stringify(vazio), /ia_preliminar/);
    const ok = payloadProtocoloIaFicha({
      anamnese: [{ conteudo: "Oleosidade" }],
      analises: [{ texto_validado: "Pele mista" }],
    });
    assert.match(rotuloFonteIa(ok), /anamnese/);
    assert.match(rotuloFonteIa(ok), /avaliação validada/);
    assert.doesNotMatch(rotuloFonteIa(ok), /ia_preliminar/);
  });

  it("preview Usar/Descartar não registra sozinho e não tem rota Atendimentos", () => {
    const view = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(view, /id="protocoloIaPreview"/);
    assert.match(view, /btnProtocoloIaUsar/);
    assert.match(view, /btnProtocoloIaDescartar/);
    assert.match(view, /mostrarPreviewIa/);
    const i = view.indexOf('getElementById("btnProtocoloRascunhoIa")');
    const k = view.indexOf('getElementById("btnProtocoloIaUsar")');
    const j = view.indexOf('getElementById("btnRegistrarProtocolo")');
    assert.ok(i > 0 && k > i && j > k);
    const iaClick = view.slice(i, k);
    assert.match(iaClick, /mostrarPreviewIa/);
    assert.doesNotMatch(iaClick, /createProtocoloAplicado/);
    assert.doesNotMatch(iaClick, /createLancamento/);
    assert.doesNotMatch(iaClick, /ta\.value = texto/);
    const usar = view.slice(k, j);
    assert.match(usar, /ta\.value = texto/);
    assert.doesNotMatch(usar, /createProtocoloAplicado/);
    assert.doesNotMatch(view, /view-atendimentos|#atendimentos/);
    const css = readFileSync(join(ROOT, "js/css/style.css"), "utf8");
    assert.match(css, /protocolo-ia-preview/);
    assert.match(css, /--sc-violet/);
  });
});
