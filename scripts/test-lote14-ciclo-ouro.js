/**
 * Lote 14 — ciclo ouro: aceite sem duplicar, baixa de pacote sem preço cheio.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deveGerarPacotesNoAceite,
  pacotesDoAceite,
  sugerirPacoteNaAgenda,
  valorFinanceiroNaBaixa,
  jaConsumiuAgenda,
} from "../js/utils/ciclo-ouro.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("ciclo ouro orçamento → pacote → baixa", () => {
  it("aceite gera um pacote por linha e não repete se já aceito", () => {
    const items = [{ name: "Laser", qty: 10, unit_price: 250, sessions: 10, procedure_id: "p1" }];
    const pkgs = pacotesDoAceite(items, "c1", "o1");
    assert.equal(pkgs.length, 1);
    assert.equal(pkgs[0].total_sessoes, 10);
    assert.equal(pkgs[0].valor_pago, 2500);
    assert.equal(pkgs[0].orcamento_id, "o1");
    assert.equal(deveGerarPacotesNoAceite("enviado"), true);
    assert.equal(deveGerarPacotesNoAceite("aceito"), false);
    assert.equal(deveGerarPacotesNoAceite("recusado"), false);
  });

  it("baixa com pacote usa valor da sessão, não o preço de catálogo", () => {
    const cheio = valorFinanceiroNaBaixa({
      pacoteId: null,
      valorProcedimento: 400,
      acrescimo: 0,
    });
    assert.equal(cheio, 400);
    const sessao = valorFinanceiroNaBaixa({
      pacoteId: "pk",
      valorProcedimento: 400,
      valorPagoPacote: 2500,
      totalSessoes: 10,
      acrescimo: 50,
    });
    assert.equal(sessao, 300);
    assert.equal(jaConsumiuAgenda([{ agenda_id: "a1" }], "a1"), true);
    assert.equal(jaConsumiuAgenda([{ agenda_id: "a1" }], "a2"), false);
    const sug = sugerirPacoteNaAgenda("p1", [
      { id: "x", procedure_id: "p1" },
    ]);
    assert.equal(sug, "x");
  });

  it("código amarra aceite e baixa sem tabela paralela", () => {
    const perfil = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    const sql = readFileSync(join(ROOT, "supabase/supabase-ciclo-ouro-colar.sql"), "utf8");
    assert.match(perfil, /aceitarOrcamento/);
    assert.match(agenda, /valorFinanceiroNaBaixa/);
    assert.match(agenda, /consumirSessao/);
    assert.match(sql, /orcamento_id/);
    assert.match(sql, /idx_package_consumptions_agenda_unica/);
    assert.doesNotMatch(perfil, /client_packages2/);
  });
});
