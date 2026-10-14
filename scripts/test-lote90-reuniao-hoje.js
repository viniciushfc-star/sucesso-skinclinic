/**
 * Lote 90 — reunião de hoje: forte, fraco e gargalo com fonte.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gargaloDoCiclo, pontoForteHoje, montarReuniaoHoje, textoContextoReuniao } from "../js/utils/reuniao-hoje.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 90 reunião de hoje", () => {
  it("gargalo segue o ciclo com número da casa", () => {
    const atraso = gargaloDoCiclo({ atrasos: 2, hojeCount: 5 });
    assert.equal(atraso.elo, "chegou");
    assert.match(atraso.titulo, /2 horários/);
    assert.equal(atraso.fonte, "agenda de hoje");
    const baixa = gargaloDoCiclo({ previsto: 1000, recebido: 100, hojeCount: 4 });
    assert.equal(baixa.elo, "baixa");
    assert.match(baixa.texto, /não cobra sozinho/);
    const vazia = gargaloDoCiclo({ hojeCount: 0 });
    assert.equal(vazia.elo, "agenda");
  });

  it("forte só com evidência; reunião não inventa", () => {
    const forte = pontoForteHoje({ hojeCount: 3, confirmados: 3, atrasos: 0 });
    assert.match(forte.titulo, /3 horários/);
    const vazio = pontoForteHoje({});
    assert.equal(vazio, null);
    const r = montarReuniaoHoje({
      hojeCount: 4,
      confirmados: 1,
      atrasos: 2,
      previsto: 800,
      recebido: 50,
      atencao: [{ title: "2 atendimentos em atraso", causa: "Horário passou.", impacto: "Sala ociosa.", fonte: "agenda de hoje", view: "agenda", score: 1 }],
    });
    assert.equal(r.titulo, "Reunião de hoje");
    assert.equal(r.gargalo.elo, "chegou");
    assert.match(textoContextoReuniao(r), /Gargalo/);
    assert.doesNotMatch(textoContextoReuniao(r), /WhatsApp sai/);
  });

  it("cockpit e dashboard mostram a reunião", () => {
    const dash = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(dash, /cockpitReuniao/);
    const view = readFileSync(join(ROOT, "js/views/dashboard.views.js"), "utf8");
    assert.match(view, /renderReuniaoHoje/);
    assert.match(view, /btnReuniaoExplicar/);
    const cock = readFileSync(join(ROOT, "js/services/cockpit.service.js"), "utf8");
    assert.match(cock, /montarReuniaoHoje/);
    assert.doesNotMatch(view, /view-atendimentos|#atendimentos/);
  });
});
