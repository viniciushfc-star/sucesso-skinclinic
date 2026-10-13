/**
 * Lote 5 — P&L: preço calculado (custo), estoque sem inventar zero.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeProcedurePnL } from "../js/utils/procedimento-pl.js";
import {
  custoRealFromUsage,
  joinUsageRef,
  qtyFromRendimento,
  qtyFromUsaRende,
  custoRealFromBaixaLinhas,
  linhaBaixaFromUsage,
  quantidadeConsumoBaixa,
  rendimentoFromQty,
  splitUsageRef,
} from "../js/utils/estoque-custo.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 5 P&L e estoque", () => {
  it("lucro e lucro/hora com material, sem inventar estrutural", () => {
    const pl = computeProcedurePnL({
      preco: 300,
      durationMinutes: 60,
      material: 60,
      comissaoPct: 0,
      taxaPct: 0,
      custoEstrutural: null,
    });
    assert.equal(pl.lucro, 240);
    assert.equal(pl.lucroHora, 240);
    assert.equal(pl.custoEstrutural, null);
  });

  it("precoCalculado usa estrutura; sem base fica nulo", () => {
    const com = computeProcedurePnL({
      material: 100,
      comissaoPct: 0,
      taxaPct: 0,
      margemAlvo: 50,
    });
    assert.equal(com.precoCalculado, 200);
    const sem = computeProcedurePnL({ preco: 300, durationMinutes: 60 });
    assert.equal(sem.precoCalculado, null);
  });

  it("item de estoque sem custo médio não vira R$ 0", () => {
    const out = custoRealFromUsage(
      [{ item_ref: "Agulha", quantity_used: 2 }],
      {}
    );
    assert.equal(out.incompleto, true);
    assert.equal(out.custoReal, null);
    const ok = custoRealFromUsage(
      [{ item_ref: "Agulha", quantity_used: 2 }],
      { agulha: 5 }
    );
    assert.equal(ok.incompleto, false);
    assert.equal(ok.custoReal, 10);
  });

  it("custo da sessão é valor do produto dividido pelo rendimento", () => {
    assert.equal(qtyFromRendimento(200), 0.005);
    assert.equal(rendimentoFromQty(0.005), 200);
    const out = custoRealFromUsage(
      [{ item_ref: "Máscara facial", quantity_used: qtyFromRendimento(200) }],
      { "máscara facial": 99 }
    );
    assert.equal(out.custoReal, 0.5);
    const luva = custoRealFromUsage(
      [{ item_ref: "Luva nitrilo caixa 100", quantity_used: qtyFromRendimento(50) }],
      { "luva nitrilo caixa 100": 40 }
    );
    assert.equal(luva.custoReal, 0.8);
  });

  it("3 pares por sessão numa caixa de 50 a R$ 40", () => {
    assert.equal(qtyFromUsaRende(3, 50), 0.06);
    assert.equal(joinUsageRef("Luva nitrilo caixa 100", "par", 3, 50), "Luva nitrilo caixa 100@@par@@3/50");
    assert.deepEqual(splitUsageRef("Luva nitrilo caixa 100@@par@@3/50"), {
      nome: "Luva nitrilo caixa 100",
      unidade: "par",
      usa: 3,
      rende: 50,
    });
    const out = custoRealFromUsage(
      [{ item_ref: joinUsageRef("Luva nitrilo caixa 100", "par", 3, 50) }],
      { "luva nitrilo caixa 100": 40 }
    );
    assert.equal(out.custoReal, 2.4);
    assert.equal(out.itens[0].usa, 3);
    const linha = linhaBaixaFromUsage({ item_ref: joinUsageRef("Luva nitrilo caixa 100", "par", 3, 50) });
    assert.equal(linha.usa, 3);
    assert.equal(linha.rende, 50);
    assert.equal(linha.vaga, false);
    assert.equal(quantidadeConsumoBaixa(linha), 0.06);
    const dia = custoRealFromBaixaLinhas(
      [{ produto_nome: "Luva nitrilo caixa 100", quantidade: qtyFromUsaRende(2, 50) }],
      { "luva nitrilo caixa 100": 40 }
    );
    assert.equal(dia.custoReal, 1.6);
    const vagaLinha = linhaBaixaFromUsage({ item_ref: "vaga:emoliente" });
    assert.equal(vagaLinha.vaga, true);
    assert.equal(vagaLinha.nome, "");
  });

  it("unidade no item_ref não quebra o custo nem a vaga", () => {
    assert.equal(joinUsageRef("Máscara facial", "gramas"), "Máscara facial@@g");
    assert.deepEqual(splitUsageRef("Máscara facial@@g"), {
      nome: "Máscara facial",
      unidade: "g",
      usa: null,
      rende: null,
    });
    const out = custoRealFromUsage(
      [{ item_ref: joinUsageRef("Máscara facial", "g"), quantity_used: qtyFromRendimento(200) }],
      { "máscara facial": 99 }
    );
    assert.equal(out.custoReal, 0.5);
    assert.equal(out.itens[0].unidade, "g");
    const vaga = custoRealFromUsage(
      [{ item_ref: "vaga:mascara@@ml", quantity_used: 1 }],
      { mascara: 40 }
    );
    assert.equal(vaga.custoReal, null);
    assert.equal(vaga.itens[0].vaga, true);
    const aluguel = custoRealFromUsage(
      [{ item_ref: "aluguel:dia", quantity_used: 800 }],
      { "aluguel:dia": 800 }
    );
    assert.equal(aluguel.custoReal, null);
    assert.equal(aluguel.itens[0].aluguel, true);
  });

  it("vaga de máscara não puxa custo de um produto com nome parecido", () => {
    const out = custoRealFromUsage(
      [{ item_ref: "vaga:mascara", quantity_used: 1 }],
      { mascara: 40 }
    );
    assert.equal(out.incompleto, false);
    assert.equal(out.custoReal, null);
    assert.equal(out.itens[0].vaga, true);
  });

  it("receita do procedimento grava usage e não chama IA nem baixa", () => {
    const svc = readFileSync(join(ROOT, "js/services/procedimentos.service.js"), "utf8");
    const view = readFileSync(join(ROOT, "js/views/procedimento.views.js"), "utf8");
    assert.match(svc, /export async function replaceProcedureStockUsage/);
    assert.match(svc, /USAGE_VAGA_PREFIX/);
    assert.match(view, /usageEditorHtml/);
    assert.match(view, /collectUsageFromForm/);
    assert.match(view, /proc-usage-usa/);
    assert.match(view, /proc-usage-rendimento/);
    assert.match(view, /proc-usage-unidade/);
    assert.match(view, /UNIDADES_RECEITA/);
    assert.match(view, /profissional escolhe a marca no dia/);
    assert.match(view, /Receita deste procedimento/);
    assert.match(view, /Usa nesta ficha/);
    assert.doesNotMatch(view, /gerarSkincare|whatsapp-send/);
  });

  it("API e tela não chamam de preço de mercado nem ideal", () => {
    const api = readFileSync(join(ROOT, "routes/preco.js"), "utf8");
    const view = readFileSync(join(ROOT, "js/views/procedimento.views.js"), "utf8");
    const svc = readFileSync(join(ROOT, "js/services/procedimento-pl.service.js"), "utf8");
    assert.match(api, /preco_calculado/);
    assert.match(api, /Não invente preço de concorrente/);
    assert.doesNotMatch(api, /preço ideal/);
    assert.match(view, /estrutura de custos, não mercado/);
    assert.match(svc, /não mercado/);
    assert.match(svc, /não altera o preço/);
  });
});
