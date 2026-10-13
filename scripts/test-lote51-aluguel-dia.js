/**
 * Lote 51 — aluguel de equipamento no dia + ponto de equilíbrio.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  capacidadeNoDia,
  CENARIO_DIA_HIFU,
  contaDiaEquipamento,
  parseAluguelCadastro,
  stripAluguelMarker,
  textoContaDia,
  withAluguelMarker,
} from "../js/utils/aluguel-dia.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 51 aluguel do dia", () => {
  it("cenário dia de HIFU: 2 pagam o aluguel, 4 sobram na margem, 8 lotam o dia", () => {
    const c = contaDiaEquipamento(CENARIO_DIA_HIFU);
    assert.equal(c.contribuicao, 432);
    assert.equal(c.nPagar, 2);
    assert.equal(c.nSobra, 4);
    assert.equal(c.capacidade, 8);
    assert.equal(c.pagaNoDia, true);
    assert.equal(c.sobraNoDia, true);
    assert.equal(c.lotado.receita, 3600);
    assert.equal(c.lotado.lucro, 2656);
    assert.match(textoContaDia(c, { nomeProc: CENARIO_DIA_HIFU.nome }), /2 atendimentos/);
    assert.match(textoContaDia(c, { nomeProc: CENARIO_DIA_HIFU.nome }), /4 atendimentos/);
  });

  it("com comissão de 20% ainda cabe no dia", () => {
    const c = contaDiaEquipamento({ ...CENARIO_DIA_HIFU, comissaoPct: 20 });
    assert.equal(c.comissao, 90);
    assert.equal(c.contribuicao, 342);
    assert.equal(c.nPagar, 3);
    assert.equal(c.nSobra, 5);
    assert.equal(c.pagaNoDia, true);
  });

  it("quantos atendimentos pagam o aluguel e ainda sobram", () => {
    const c = contaDiaEquipamento({
      aluguelDia: 800,
      preco: 400,
      material: 40,
      comissaoPct: 0,
      taxaPct: 0,
      durationMinutes: 60,
      horasDia: 8,
      margemAlvoPct: 40,
    });
    assert.equal(c.contribuicao, 360);
    assert.equal(c.nPagar, 3);
    assert.equal(c.nSobra, 4);
    assert.equal(c.capacidade, 8);
    assert.equal(c.pagaNoDia, true);
    assert.equal(c.lotado.lucro, 2080);
  });

  it("duração longa pode não pagar o aluguel nem lotando", () => {
    const c = contaDiaEquipamento({
      aluguelDia: 800,
      preco: 185,
      material: 9.86,
      durationMinutes: 120,
      horasDia: 8,
    });
    assert.equal(c.capacidade, 4);
    assert.equal(c.nPagar, 5);
    assert.equal(c.pagaNoDia, false);
    assert.match(textoContaDia(c), /não se paga/);
  });

  it("capacidade do dia é horas × 60 ÷ duração", () => {
    assert.equal(capacidadeNoDia({ durationMinutes: 90, horasDia: 6 }), 4);
  });

  it("grava na descrição sem coluna nova e esconde o marcador", () => {
    const desc = withAluguelMarker("Laser fracionado", { dia: 800, horas: 8, equip: "HIFU" });
    assert.match(desc, /\[\[sc-eq:800\|8\|HIFU\]\]/);
    assert.equal(stripAluguelMarker(desc), "Laser fracionado");
    const parsed = parseAluguelCadastro({ description: desc });
    assert.equal(parsed.dia, 800);
    assert.equal(parsed.equip, "HIFU");
  });

  it("ficha do procedimento tem o bloco e não altera preço", () => {
    const view = readFileSync(join(ROOT, "js/views/procedimento.views.js"), "utf8");
    assert.match(view, /aluguelEditorHtml/);
    assert.match(view, /procAluguelDia/);
    assert.match(view, /não muda o preço do paciente/);
    assert.match(view, /textoContaDia/);
  });
});
