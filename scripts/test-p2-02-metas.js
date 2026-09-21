/**
 * P2-2 — ritmo e projeção de meta (sem XP).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parsePeriodoRef,
  monthBounds,
  daysElapsedInMonth,
  realizadoFromLancamentos,
  explainMetaRitmo,
} from "../js/utils/meta-ritmo.js";

describe("P2-2 metas ritmo", () => {
  it("YYYY-MM vira bounds do mês", () => {
    const p = parsePeriodoRef("2026-09");
    assert.equal(p.year, 2026);
    assert.equal(p.month, 9);
    const b = monthBounds(2026, 9);
    assert.equal(b.start, "2026-09-01");
    assert.equal(b.end, "2026-09-30");
    assert.equal(b.daysInMonth, 30);
  });

  it("realizado de receita soma entradas do período", () => {
    const rows = [
      { tipo: "entrada", data: "2026-09-02", valor: 100 },
      { tipo: "saida", data: "2026-09-03", valor: 40 },
      { tipo: "entrada", data: "2026-08-31", valor: 999 },
    ];
    assert.equal(realizadoFromLancamentos("receita_mensal", rows, "2026-09-01", "2026-09-30"), 100);
    assert.equal(realizadoFromLancamentos("lucro_mensal", rows, "2026-09-01", "2026-09-30"), 60);
  });

  it("projeção no ritmo atual e copy de não garantia", () => {
    const asOf = new Date(2026, 8, 15);
    assert.equal(daysElapsedInMonth(2026, 9, asOf), 15);
    const r = explainMetaRitmo({
      tipo: "receita_mensal",
      valorMeta: 3000,
      realizado: 1500,
      year: 2026,
      month: 9,
      asOf,
    });
    assert.equal(r.kind, "mensal");
    assert.equal(r.projetado, 3000);
    assert.equal(r.onTrack, true);
    assert.match(r.copy, /não garantia/i);
  });

  it("fora do ritmo pede valor por dia restante", () => {
    const asOf = new Date(2026, 8, 21);
    const r = explainMetaRitmo({
      tipo: "receita_mensal",
      valorMeta: 30000,
      realizado: 3000,
      year: 2026,
      month: 9,
      asOf,
    });
    assert.equal(r.onTrack, false);
    assert.ok(r.ritmoNecessario > r.ritmoAtual);
    assert.match(r.copy, /dia/);
  });
});
