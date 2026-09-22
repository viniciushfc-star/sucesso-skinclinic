/**
 * P2-7 — lucro/hora estimado, sem alterar preço.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  lucroHoraEstimado,
  lucroHoraOpportunity,
  rankLucroHora,
} from "../js/utils/lucro-hora.js";
import { buildOpportunityInsights } from "../js/services/intelligence.service.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("P2-7 lucro/hora", () => {
  it("sem preço ou duração fica nulo", () => {
    assert.equal(lucroHoraEstimado({ preco: 200, durationMinutes: 0 }), null);
    assert.equal(lucroHoraEstimado({ preco: null, durationMinutes: 60 }), null);
  });

  it("R$ 300 em 60 min com material 60 vira 240/h", () => {
    assert.equal(
      lucroHoraEstimado({ preco: 300, durationMinutes: 60, custoMaterialEstimado: 60 }),
      240
    );
  });

  it("ranking e insight não mandam mudar preço", () => {
    const ranked = rankLucroHora([
      { id: "a", name: "A", valor_cobrado: 600, duration_minutes: 30, custo_material_estimado: 0 },
      { id: "b", name: "B", valor_cobrado: 120, duration_minutes: 60, custo_material_estimado: 0 },
    ]);
    assert.equal(ranked[0].id, "a");
    const card = lucroHoraOpportunity(ranked);
    assert.match(card.reason, /não altera o preço/);
  });

  it("oportunidade extra não quebra radar e não dispara WhatsApp", () => {
    const cards = buildOpportunityInsights({
      espera: 1,
      radar: 1,
      lucroHora: lucroHoraOpportunity(
        rankLucroHora([
          { id: "a", name: "A", valor_cobrado: 800, duration_minutes: 30 },
          { id: "b", name: "B", valor_cobrado: 80, duration_minutes: 90 },
        ])
      ),
    });
    assert.ok(cards.some((c) => c.theme === "lucro_hora"));
    const src = readFileSync(join(root, "js/utils/lucro-hora.js"), "utf8");
    assert.doesNotMatch(src, /WhatsApp/);
  });
});
