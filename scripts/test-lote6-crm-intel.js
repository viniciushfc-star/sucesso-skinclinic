/**
 * Lote 6 — CRM uma pessoa um clique; Intelligence com ação explícita.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAttentionInsights, buildOpportunityInsights } from "../js/services/intelligence.service.js";
import { lucroHoraOpportunity, rankLucroHora } from "../js/utils/lucro-hora.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 6 CRM e Intelligence", () => {
  it("cada card tem o que fazer e para onde ir", () => {
    const cards = buildAttentionInsights({
      atrasos: 1,
      contasVencidas: 1,
      analisesPendentes: 1,
      inativos: 2,
      produtosRisco: 1,
    });
    assert.ok(cards.length <= 5);
    for (const c of cards) {
      assert.ok(c.action && c.view && c.reason && c.title, c.theme);
    }
    assert.match(cards.find((c) => c.theme === "atraso").action, /agenda/i);
  });

  it("lucro/hora também traz ação sem mudar preço", () => {
    const ranked = rankLucroHora([
      { id: "a", name: "A", valor_cobrado: 600, duration_minutes: 30, custo_material_estimado: 0 },
      { id: "b", name: "B", valor_cobrado: 120, duration_minutes: 60, custo_material_estimado: 0 },
    ]);
    const card = lucroHoraOpportunity(ranked);
    assert.match(card.action, /você altera/i);
    assert.match(card.reason, /não altera o preço/i);
  });

  it("WhatsApp do CRM só na fila e na espera", () => {
    const src = readFileSync(join(ROOT, "js/views/crm.views.js"), "utf8");
    const wa = [...src.matchAll(/class="[^"]*\bcrm-wa\b/g)];
    assert.equal(wa.length, 2);
    assert.match(src, /data-origem="crm_fila"/);
    assert.match(src, />Avisar</);
    assert.match(src, /WhatsApp na fila acima/);
  });

  it("cockpit mostra a ação do insight", () => {
    const dash = readFileSync(join(ROOT, "js/views/dashboard.views.js"), "utf8");
    assert.match(dash, /cockpit-row-action/);
    assert.match(dash, /card\.action/);
  });
});
