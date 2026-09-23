/**
 * Lote 5 — P&L: preço calculado (custo), estoque sem inventar zero.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeProcedurePnL } from "../js/utils/procedimento-pl.js";
import { custoRealFromUsage } from "../js/utils/estoque-custo.js";

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
