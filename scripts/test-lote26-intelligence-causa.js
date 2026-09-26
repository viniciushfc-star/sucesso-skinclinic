/**
 * Lote 26 — Intelligence causa → impacto → ação com fonte.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { montarInsightCausa, buildAttentionInsights } from "../js/services/intelligence.service.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("intelligence causa impacto fonte", () => {
  it("card traz fonte e não inventa contagem", () => {
    const c = montarInsightCausa({
      theme: "atraso",
      title: "1 atraso",
      causa: "Horário passou.",
      impacto: "Sala ociosa.",
      acao: "Abrir agenda",
      fonte: "agenda de hoje",
      urgency: 1,
      impact: 1,
      actionable: 1,
      count: 1,
    });
    assert.equal(c.fonte, "agenda de hoje");
    assert.match(c.reason, /Fonte: agenda de hoje/);
    const cards = buildAttentionInsights({ atrasos: 2 });
    assert.equal(cards[0].count, 2);
    assert.equal(cards[0].fonte, "agenda de hoje");
  });

  it("cockpit mostra causa e fonte", () => {
    const view = readFileSync(join(ROOT, "js/views/dashboard.views.js"), "utf8");
    assert.match(view, /cockpit-row-causa/);
    assert.match(view, /cockpit-row-fonte/);
    const src = readFileSync(join(ROOT, "js/services/intelligence.service.js"), "utf8");
    assert.equal(src.includes("whatsapp"), false);
  });
});
