/**
 * Lote 34 — IA Consultora: número só com fonte; não inventa.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MSG_SEM_FONTE,
  montarFatosConsultora,
  responderConsultora,
  auditarRespostaConsultora,
  respostaInventouNumero,
  intentConsultora,
} from "../js/utils/ia-consultora.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const fatos = montarFatosConsultora({
  clientesTotal: 12,
  financeiroTotal: 1500.5,
  financeiroCount: 3,
  financeiroMedia: 500.17,
  financeiroPorTipo: { entrada: 1200, saida: 300.5 },
  agendaTotal: 8,
});

describe("ia consultora", () => {
  it("responde cadastro e faturamento com fonte; mercado fica não informado", () => {
    const c = responderConsultora("quantos clientes temos?", fatos);
    assert.equal(c.valor, 12);
    assert.match(c.texto, /Fonte:/);
    assert.match(c.fonte, /cadastro de clientes/);
    const f = responderConsultora("qual o faturamento?", fatos);
    assert.equal(f.valor, 1200);
    assert.equal(intentConsultora("preço de mercado do concorrente"), "fora");
    assert.equal(responderConsultora("preço de mercado do concorrente", fatos).texto, MSG_SEM_FONTE);
  });

  it("descarta número que a IA inventou", () => {
    assert.equal(respostaInventouNumero("O faturamento é 99999", fatos, "faturamento"), true);
    const audit = auditarRespostaConsultora("O faturamento é 99999", fatos, "faturamento");
    assert.equal(audit.ok, false);
    assert.equal(audit.texto, MSG_SEM_FONTE);
    const ok = auditarRespostaConsultora("Há 12 clientes na amostra.", fatos, "quantos clientes");
    assert.equal(ok.ok, true);
  });

  it("tela e API exigem fonte; copiloto não mistura radar", () => {
    const view = readFileSync(join(ROOT, "js/views/copiloto.views.js"), "utf8");
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    const api = readFileSync(join(ROOT, "routes/copiloto.js"), "utf8");
    assert.match(view, /respostaFonte/);
    assert.doesNotMatch(view, /market-radar/);
    assert.match(html, /respostaFonte/);
    assert.match(html, /não inventa/);
    assert.match(api, /responderConsultora/);
    assert.match(api, /auditarRespostaConsultora/);
    assert.doesNotMatch(api, /tryDeterministicAnswer/);
  });
});
