/**
 * Lote 31 — rateio completo: fórmula, ocupação, simulação. Sem inventar, sem mudar preço.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  calcularRateio,
  ocupacaoRateio,
  simularMetodosRateio,
} from "../js/utils/rateio.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("rateio completo", () => {
  it("hora e atendimento batem; sem denominador não inventa", () => {
    const hora = calcularRateio({
      metodo: "hora",
      fixoMes: 1600,
      horasMes: 160,
      durationMinutes: 60,
    });
    assert.equal(hora.valor, 10);
    const at = calcularRateio({ metodo: "atendimento", fixoMes: 1000, nAtendimentos: 10 });
    assert.equal(at.valor, 100);
    const vazio = calcularRateio({ metodo: "hora", fixoMes: 1600 });
    assert.equal(vazio.valor, null);
    const nao = calcularRateio({ metodo: "nao_ratear", fixoMes: 9999 });
    assert.equal(nao.valor, null);
    const oc = ocupacaoRateio({ metodo: "capacidade", nAtendimentos: 50, capacidadeMes: 200 });
    assert.equal(oc.pct, 25);
    const sims = simularMetodosRateio({
      fixoMes: 1600,
      horasMes: 160,
      durationMinutes: 60,
      nAtendimentos: 10,
    });
    assert.equal(sims.find((s) => s.metodo === "nao_ratear").valor, null);
    assert.equal(sims.find((s) => s.metodo === "hora").valor, 10);
  });

  it("DRE mostra fórmula; cancelados ficam de fora; preço não muda", () => {
    const view = readFileSync(join(ROOT, "js/views/financeiro.views.js"), "utf8");
    const svc = readFileSync(join(ROOT, "js/services/rateio.service.js"), "utf8");
    assert.match(view, /financeiroDreRateio/);
    assert.match(view, /não altera o preço/);
    assert.match(svc, /cancelled_at/);
    assert.match(svc, /calcularRateio/);
    assert.doesNotMatch(svc, /valor_cobrado/);
  });
});
