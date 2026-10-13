/**
 * Lote 61 — rascunho na ficha (local + IA); humano confirma; sem preço automático.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  textoRascunhoLocal,
  produtosRascunhoLocal,
  textoRascunhoDeIa,
  payloadProtocoloIaFicha,
  temFonteParaIa,
} from "../js/utils/protocolo-rascunho-ficha.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 61 IA na ficha", () => {
  it("rascunho local vem do protocolo/receita, sem preço", () => {
    const t = textoRascunhoLocal({
      protocolo: { nome: "Limpeza profunda", descricao_passos: "Higienizar, extrair, máscara" },
      sessoes: [{ procedimento: "Limpeza" }],
    });
    assert.match(t, /Limpeza profunda/);
    assert.match(t, /Higienizar/);
    const prods = produtosRascunhoLocal([{ produto_nome: "Gaze", quantidade: 2 }]);
    assert.equal(prods[0].produto_nome, "Gaze");
    assert.equal(prods[0].quantidade, 2);
  });

  it("IA vira texto sem R$ e só com fonte validada", () => {
    const txt = textoRascunhoDeIa(
      JSON.stringify({
        procedimentos: [{ nome: "Peeling R$ 400" }, "LED"],
        cuidados: ["Protetor"],
        tempo_estimado: "45 min",
      })
    );
    assert.match(txt, /Peeling/);
    assert.match(txt, /LED/);
    assert.doesNotMatch(txt, /R\$/);
    const vazio = payloadProtocoloIaFicha({ anamnese: [], analises: [{ ia_preliminar: "não use" }] });
    assert.equal(temFonteParaIa(vazio), false);
    assert.equal(JSON.stringify(vazio).includes("ia_preliminar"), false);
    const ok = payloadProtocoloIaFicha({
      anamnese: [{ conteudo: "Oleosidade" }],
      analises: [{ texto_validado: "Pele mista" }],
      planos: [{ nome: "Oleosidade" }],
    });
    assert.equal(temFonteParaIa(ok), true);
    assert.equal(ok.analise.pele_validada[0], "Pele mista");
  });

  it("ficha sugere e não registra sozinha", () => {
    const view = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(view, /btnProtocoloRascunho/);
    assert.match(view, /btnProtocoloRascunhoIa/);
    assert.match(view, /ia:assist/);
    assert.match(view, /payloadProtocoloIaFicha/);
    assert.match(view, /temFonteParaIa/);
    const i = view.indexOf('getElementById("btnProtocoloRascunhoIa")');
    const j = view.indexOf('getElementById("btnRegistrarProtocolo")');
    assert.ok(i > 0 && j > i);
    const rascunho = view.slice(i, j);
    assert.doesNotMatch(rascunho, /createProtocoloAplicado/);
    assert.doesNotMatch(rascunho, /createLancamento/);
    assert.doesNotMatch(view, /view-atendimentos|#atendimentos/);
  });
});
