/**
 * Lote 77 — procedimento: custo + taxa + faixa citada. Sem gravar preço. Sem inventar concorrente.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { casarRadarRef, isFonteCompleta } from "../js/utils/market-radar.js";
import { leituraNaoPerder, mercadoParaIa } from "../js/utils/preco-nao-perder.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const radar = {
  procedimento: "Limpeza de pele",
  procedure_id: "abc",
  regiao: "Campinas",
  fonte: "pesquisa própria n=8",
  data_ref: "2026-09-01",
  metodologia: "ligação a clínicas da região",
  confianca: "media",
  amostra: 8,
  preco_min: 180,
  preco_max: 280,
};

describe("Lote 77 não perder dinheiro na precificação", () => {
  it("casa por id e por nome; sem fonte não compara", () => {
    assert.equal(casarRadarRef([radar], { procedureId: "abc" }).fonte, radar.fonte);
    assert.equal(casarRadarRef([radar], { nome: "Limpeza de Pele" }).preco_min, 180);
    assert.equal(casarRadarRef([{ ...radar, fonte: "" }], { nome: "Limpeza de pele" }), null);
    assert.equal(isFonteCompleta({ ...radar, fonte: "" }), false);
  });

  it("abaixo da faixa e da margem alerta; não manda cobrar um preço", () => {
    const l = leituraNaoPerder({
      preco: 120,
      custo: 90,
      margemAlvo: 40,
      liquidoAvista: 116,
      taxaAvistaPct: 3.5,
      minAvistaAlvo: 160,
      radar,
    });
    assert.equal(l.tom, "warning");
    assert.match(l.titulo, /deixar dinheiro|Abaixo/i);
    assert.match(l.alerta, /abaixo da referência observada/);
    assert.doesNotMatch(l.alerta, /cobre/i);
    assert.doesNotMatch(JSON.stringify(l), /concorrente invent/i);
  });

  it("sem radar não inventa mercado; IA só recebe fonte completa", () => {
    const sem = leituraNaoPerder({ preco: 200, custo: 80, margemAlvo: 40 });
    assert.equal(sem.temRadar, false);
    assert.match(sem.alerta, /não compara/i);
    assert.equal(mercadoParaIa({ ticket: 200, concorrencia: "x" }), null);
    const ok = mercadoParaIa(radar);
    assert.equal(ok.tipo, "radar");
    assert.equal(ok.preco_min, 180);
    assert.equal(mercadoParaIa({ ...radar, fonte: "" }), null);
  });

  it("procedimento mostra o cartão; rota de preço usa mercadoParaIa; copiloto não mistura", () => {
    const view = readFileSync(join(ROOT, "js/views/procedimento.views.js"), "utf8");
    assert.match(view, /procNaoPerder/);
    assert.match(view, /leituraNaoPerder/);
    assert.match(view, /listMarketRadar/);
    assert.match(view, /mercado: radar/);
    assert.doesNotMatch(view, /sendWhatsapp/);
    const rota = readFileSync(join(ROOT, "routes/preco.js"), "utf8");
    assert.match(rota, /mercadoParaIa/);
    assert.match(rota, /Não invente/);
    const cop = readFileSync(join(ROOT, "js/views/copiloto.views.js"), "utf8");
    assert.doesNotMatch(cop, /market-radar/);
  });
});
