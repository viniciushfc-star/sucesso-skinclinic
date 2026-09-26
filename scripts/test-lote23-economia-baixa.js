/**
 * Lote 23 — fórmula da baixa com insumo real e simulação de desconto/parcela.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  escolherCustoMaterial,
  economiaAtendimento,
  simularDescontoParcela,
  textoEconomiaAtendimento,
  textoSimulacaoBaixa,
} from "../js/utils/economia-atendimento.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("economia da baixa com insumo real", () => {
  it("prefere estoque, não inventa custo e não grava desconto", () => {
    assert.equal(escolherCustoMaterial({ real: 50, incompleto: false, estimado: 40 }).fonte, "estoque");
    assert.equal(escolherCustoMaterial({ real: 50, incompleto: false, estimado: 40 }).valor, 50);
    assert.equal(escolherCustoMaterial({ real: 50, incompleto: true, estimado: 40 }).fonte, "estimado");
    assert.equal(escolherCustoMaterial({ estimado: null }).valor, null);
    const eco = economiaAtendimento({
      receita: 250,
      custoMaterial: 50,
      fonteCusto: "estoque",
      comissaoPct: 10,
      taxaPct: 4,
      margemAlvoPct: 40,
    });
    assert.equal(eco.comissao, 25);
    assert.equal(eco.taxa, 10);
    assert.equal(eco.lucro, 165);
    assert.match(textoEconomiaAtendimento(eco), /insumo real/);
    const sim = simularDescontoParcela({ receita: 1000, descontoPct: 10, taxaPct: 10 });
    assert.equal(sim.aposDesconto, 900);
    assert.equal(sim.liquido, 810);
    assert.match(textoSimulacaoBaixa(sim), /Não grava desconto/);
  });

  it("baixa mostra fórmula e simulação sem clonar PDV", () => {
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(agenda, /getCustoRealProcedimento/);
    assert.match(agenda, /simularDescontoParcela/);
    assert.match(agenda, /baixaSimDesconto/);
    assert.doesNotMatch(agenda, /PAGAMENTO_APP_ENABLED\s*=\s*true/);
  });
});
