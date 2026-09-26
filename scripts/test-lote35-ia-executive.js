/**
 * Lote 35 — IA Executive: variação explicada com fonte. Sem inventar.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MSG_SEM_VARIACAO,
  explicarVariacao,
  somaConsumoNoDia,
} from "../js/utils/ia-executive.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("ia executive", () => {
  it("explica queda de recebido pelo volume da agenda e não inventa estoque", () => {
    const { cards } = explicarVariacao({
      agendaHoje: 2,
      agendaOntem: 5,
      previstoHoje: 200,
      previstoOntem: 500,
      recebidoHoje: 100,
      recebidoOntem: 400,
      baixasHoje: 1,
      baixasOntem: 4,
      consumoHoje: null,
      consumoOntem: null,
    });
    assert.equal(cards[0].metrica, "recebido");
    assert.match(cards[0].causa, /menos horários/);
    assert.match(cards[0].fonte, /agenda/);
    assert.equal(cards.some((c) => c.metrica === "estoque"), false);
    const igual = explicarVariacao({
      agendaHoje: 3,
      agendaOntem: 3,
      previstoHoje: 90,
      previstoOntem: 90,
      recebidoHoje: 90,
      recebidoOntem: 90,
    });
    assert.match(igual.cards[0].causa, new RegExp(MSG_SEM_VARIACAO.slice(0, 20)));
  });

  it("consumo do dia soma só a data; mix explica previsto sem volume", () => {
    const q = somaConsumoNoDia(
      [
        { quantidade: 2, created_at: "2026-09-26T10:00:00" },
        { quantidade: 5, created_at: "2026-09-25T10:00:00" },
      ],
      "2026-09-26"
    );
    assert.equal(q, 2);
    assert.equal(somaConsumoNoDia(null, "2026-09-26"), null);
    const mix = explicarVariacao({
      agendaHoje: 4,
      agendaOntem: 4,
      previstoHoje: 200,
      previstoOntem: 400,
      recebidoHoje: 200,
      recebidoOntem: 200,
      consumoHoje: 8,
      consumoOntem: 2,
    });
    assert.equal(mix.cards.some((c) => c.metrica === "previsto"), true);
    assert.match(mix.cards.find((c) => c.metrica === "previsto").causa, /mix/);
    assert.equal(mix.cards.some((c) => c.metrica === "estoque"), true);
    assert.match(mix.cards.find((c) => c.metrica === "estoque").impacto, /não muda preço/i);
  });

  it("cockpit mostra por que mudou; serviço chama estoque sem WhatsApp", () => {
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    const view = readFileSync(join(ROOT, "js/views/dashboard.views.js"), "utf8");
    const svc = readFileSync(join(ROOT, "js/services/cockpit.service.js"), "utf8");
    const util = readFileSync(join(ROOT, "js/utils/ia-executive.js"), "utf8");
    assert.match(html, /cockpitExecutive/);
    assert.match(view, /Por que mudou/);
    assert.match(svc, /explicarVariacao/);
    assert.match(svc, /listConsumoEstoque/);
    assert.equal(svc.includes("whatsapp"), false);
    assert.equal(util.includes("openai"), false);
  });
});
