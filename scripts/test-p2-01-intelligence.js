/**
 * P2-1 — Intelligence prioriza, não dispara.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  INTEL_MAX_CARDS,
  scoreInsight,
  prioritizeInsights,
  buildAttentionInsights,
  buildOpportunityInsights,
} from "../js/services/intelligence.service.js";

describe("P2-1 Intelligence", () => {
  it("score é urgência × impacto × acionável", () => {
    assert.equal(scoreInsight({ urgency: 1, impact: 0.5, actionable: 1 }), 0.5);
    assert.equal(scoreInsight({ urgency: 2, impact: 1, actionable: 1 }), 1);
  });

  it("fund 5 cards e um por tema", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      theme: `t${i}`,
      title: `Card ${i}`,
      score: i,
      count: 1,
    }));
    const out = prioritizeInsights(many, INTEL_MAX_CARDS);
    assert.equal(out.length, 5);
    assert.equal(out[0].theme, "t11");
  });

  it("atraso ganha de inativo; margem não muda preço", () => {
    const cards = buildAttentionInsights({
      atrasos: 3,
      inativos: 40,
      contasVencidas: 1,
      analisesPendentes: 2,
      produtosRisco: 1,
    });
    assert.ok(cards.length <= 5);
    assert.equal(cards[0].theme, "atraso");
    const margem = cards.find((c) => c.theme === "margem");
    assert.match(margem.reason, /não altera preço/i);
  });

  it("oportunidade de radar não fala em envio automático", () => {
    const cards = buildOpportunityInsights({ espera: 2, radar: 9 });
    assert.equal(cards.length, 2);
    assert.match(cards.find((c) => c.theme === "radar").reason, /clicar/i);
  });

  it("serviço não dispara WhatsApp", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../js/services/intelligence.service.js"),
      "utf8"
    );
    assert.equal(src.includes("whatsapp"), false);
    assert.equal(src.includes("valor_cobrado"), false);
  });
});
