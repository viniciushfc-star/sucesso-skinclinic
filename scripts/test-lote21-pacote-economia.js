/**
 * Lote 21 — custo, margem e comissão na sessão do pacote.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { economiaSessaoPacote, textoEconomiaSessao } from "../js/utils/pacote-consumo-economia.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("economia da sessão do pacote", () => {
  it("usa receita da sessão, não o preço cheio, e não inventa custo", () => {
    const eco = economiaSessaoPacote({
      valorPagoPacote: 2500,
      totalSessoes: 10,
      custoMaterialSessao: 40,
      comissaoPct: 10,
      margemAlvoPct: 50,
    });
    assert.equal(eco.receita, 250);
    assert.equal(eco.custo, 40);
    assert.equal(eco.comissao, 25);
    assert.equal(eco.lucro, 185);
    assert.equal(eco.abaixoAlvo, false);
    const semCusto = economiaSessaoPacote({ valorPagoPacote: 2500, totalSessoes: 10 });
    assert.equal(semCusto.incompleto, true);
    assert.equal(semCusto.lucro, null);
    const baixo = economiaSessaoPacote({
      valorPagoPacote: 200,
      totalSessoes: 10,
      custoMaterialSessao: 18,
      comissaoPct: 0,
      margemAlvoPct: 40,
    });
    assert.equal(baixo.receita, 20);
    assert.equal(baixo.abaixoAlvo, true);
    assert.match(textoEconomiaSessao(eco), /Não altera preço/);
  });

  it("aparece na baixa e no perfil, sem tabela paralela", () => {
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    const perfil = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    const svc = readFileSync(join(ROOT, "js/services/pacotes.service.js"), "utf8");
    assert.match(agenda, /economiaSessaoPacote/);
    assert.match(agenda, /baixaEconomiaHint/);
    assert.match(perfil, /textoEconomiaSessao/);
    assert.match(svc, /custo_material_estimado/);
    assert.doesNotMatch(agenda, /client_packages2/);
  });
});
