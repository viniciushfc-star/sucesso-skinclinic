/**
 * Lote 52 — margem em risco por procedimento + conta do aluguel na agenda.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  enriquecerAlertasMargem,
  htmlCardMargemRisco,
  impactoInsumoProcedimento,
  usageCasaComProduto,
} from "../js/utils/margem-risco.js";
import { CENARIO_DIA_HIFU, resumoAluguelNaAgenda, textoAluguelNaAgenda } from "../js/utils/aluguel-dia.js";
import { joinUsageRef } from "../js/utils/estoque-custo.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 52 margem em risco e dia na agenda", () => {
  it("insumo que sobe muda a margem do procedimento, sem inventar preço", () => {
    const imp = impactoInsumoProcedimento({
      preco: 185,
      qty: 1,
      custoAntigo: 60,
      custoNovo: 80,
    });
    assert.equal(imp.deltaMaterial, 20);
    assert.equal(imp.lucroAntes, 125);
    assert.equal(imp.lucroDepois, 105);
    assert.ok(imp.margemDepois < imp.margemAntes);
  });

  it("casa o produto da receita e ignora vaga/aluguel", () => {
    assert.equal(usageCasaComProduto(joinUsageRef("Luva nitrilo caixa 100", "par", 3, 50), "Luva nitrilo caixa 100"), true);
    assert.equal(usageCasaComProduto("vaga:emoliente", "emoliente"), false);
    assert.equal(usageCasaComProduto("aluguel:dia", "HIFU"), false);
  });

  it("enriquece o alerta com margem antes/depois", () => {
    const out = enriquecerAlertasMargem(
      [
        {
          produto_nome: "Ácido",
          custo_medio_anterior: 60,
          custo_novo: 80,
          variacao_percentual: 33,
        },
      ],
      {
        procedures: [{ id: "p1", name: "Limpeza de pele", valor_cobrado: 185, comissao_profissional_pct: 0 }],
        usages: [{ procedure_id: "p1", item_ref: "Ácido", quantity_used: 1 }],
        custoMedioByName: { ácido: 80 },
      }
    );
    assert.equal(out[0].impactos.length, 1);
    assert.equal(out[0].impactos[0].procedure_name, "Limpeza de pele");
    assert.equal(out[0].impactos[0].margemAntes, 67.57);
    assert.equal(out[0].impactos[0].margemDepois, 56.76);
    const html = htmlCardMargemRisco(out);
    assert.match(html, /Limpeza de pele/);
    assert.match(html, /não altera o preço/);
    assert.match(html, /#procedimento/);
  });

  it("Hoje/Agenda mostram quantos pagam o aluguel do dia", () => {
    const proc = {
      id: "hifu",
      name: CENARIO_DIA_HIFU.nome,
      description: "[[sc-eq:800|8|HIFU]]",
      duration_minutes: 60,
      valor_cobrado: 450,
      custo_material_estimado: 18,
      margem_minima_desejada: 40,
    };
    const rows = resumoAluguelNaAgenda(
      [
        { procedure_id: "hifu", procedimento: "HIFU facial" },
        { procedure_id: "hifu", procedimento: "HIFU facial" },
      ],
      [proc]
    );
    assert.equal(rows[0].n, 2);
    assert.equal(rows[0].conta.nPagar, 2);
    assert.equal(rows[0].faltaPagar, 0);
    assert.match(textoAluguelNaAgenda(rows), /já se paga/);
    const falta = resumoAluguelNaAgenda([{ procedure_id: "hifu" }], [proc]);
    assert.equal(falta[0].faltaPagar, 1);
    assert.match(textoAluguelNaAgenda(falta), /faltam 1/);
  });

  it("telas usam o card enriquecido e a faixa do dia", () => {
    const procView = readFileSync(join(ROOT, "js/views/procedimento.views.js"), "utf8");
    const fin = readFileSync(join(ROOT, "js/views/financeiro.views.js"), "utf8");
    const dash = readFileSync(join(ROOT, "js/views/dashboard.views.js"), "utf8");
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(procView, /htmlCardMargemRisco/);
    assert.match(fin, /htmlCardMargemRisco/);
    assert.match(dash, /textoAluguelNaAgenda/);
    assert.match(agenda, /agenda-aluguel-dia/);
  });
});
