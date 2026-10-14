/**
 * Lote 93 — import só depois da prévia. Atalhos caem na mesma tela. Sem WhatsApp.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  rotuloTipoImportacao,
  textoConfirmarImportacao,
  textoErroPlanilha,
} from "../js/utils/import-ritmo.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 93 import com ritual", () => {
  it("confirma em português e não dispara WhatsApp", () => {
    assert.equal(rotuloTipoImportacao("agenda"), "horários");
    const msg = textoConfirmarImportacao({ tipo: "clientes", total: 10, okEstimado: 8 });
    assert.match(msg, /8 de 10/);
    assert.match(msg, /WhatsApp não sai/);
    assert.match(msg, /Sem desfazer/);
    assert.match(textoErroPlanilha(new Error("arquivo .xls antigo")), /Salvar como/);
    assert.match(textoErroPlanilha({ message: "corrupt zip" }), /Nada foi gravado/);
  });

  it("Agenda, Financeiro e Procedimentos abrem a prévia; Export confirma de novo", () => {
    const ag = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(ag, /irParaImportacaoComPrevia\("agenda"/);
    assert.doesNotMatch(ag, /importarLote\("agenda"/);
    const fin = readFileSync(join(ROOT, "js/views/financeiro.views.js"), "utf8");
    assert.match(fin, /irParaImportacaoComPrevia\("financeiro"/);
    assert.doesNotMatch(fin, /importarLote\("financeiro"/);
    const proc = readFileSync(join(ROOT, "js/views/procedimento.views.js"), "utf8");
    assert.match(proc, /irParaImportacaoComPrevia\("procedimentos"/);
    const exp = readFileSync(join(ROOT, "js/views/export.views.js"), "utf8");
    assert.match(exp, /openConfirmModal/);
    assert.match(exp, /textoConfirmarImportacao/);
    assert.match(exp, /textoErroPlanilha/);
    assert.doesNotMatch(exp, /sendWhatsapp/);
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(html, /id="importRitmo"/);
    const spa = readFileSync(join(ROOT, "js/core/spa.js"), "utf8");
    assert.match(spa, /clinica-ux-1/);
    assert.doesNotMatch(ag, /view-atendimentos|#atendimentos/);
  });
});
