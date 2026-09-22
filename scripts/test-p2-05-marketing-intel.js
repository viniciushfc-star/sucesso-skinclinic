/**
 * P2-5 — Marketing Intelligence estruturado a partir do CRM.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MKT_MAX_CAMPANHAS,
  buildMarketingCampaigns,
  countSinais,
  custoContatoTexto,
} from "../js/utils/marketing-intelligence.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("P2-5 Marketing Intelligence", () => {
  it("radar vazio não inventa campanha", () => {
    assert.deepEqual(buildMarketingCampaigns({ counts: {} }), []);
  });

  it("pacote ganha de inativa e respeita teto", () => {
    const counts = {
      inativa: 40,
      pacote: 2,
      nova_sem_2: 3,
      atrasada: 5,
      sem_proxima: 8,
    };
    const cards = buildMarketingCampaigns({ counts });
    assert.equal(cards[0].sinal, "pacote");
    assert.equal(cards.length, MKT_MAX_CAMPANHAS);
  });

  it("custo é tempo, não R$ de anúncio", () => {
    const t = custoContatoTexto(3, 5);
    assert.match(t, /15 min/);
    assert.doesNotMatch(t, /R\$/);
    const card = buildMarketingCampaigns({ counts: { espera: 2 } })[0];
    assert.doesNotMatch(card.custoEstimado, /R\$/);
    assert.match(card.canal, /só no clique/);
    assert.match(card.disclaimer, /não garantia/);
  });

  it("countSinais agrupa o radar", () => {
    const c = countSinais([{ sinal: "pacote" }, { sinal: "pacote" }, { sinal: "inativa" }]);
    assert.equal(c.pacote, 2);
    assert.equal(c.inativa, 1);
  });

  it("view não dispara WhatsApp", () => {
    const src = readFileSync(join(root, "js/views/marketing.views.js"), "utf8");
    assert.match(src, /loadMarketingCampaigns/);
    assert.equal(src.includes("sendWhatsapp"), false);
  });
});
