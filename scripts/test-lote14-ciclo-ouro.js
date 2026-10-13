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
  addDaysIso,
  sugerirProximaAcaoNaBaixa,
  slotsAgendaDoAceite,
  sessoesDoPacoteParaAgenda,
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
    const soProduto = pacotesDoAceite(
      [{ kind: "produto", name: "Creme", qty: 1, unit_price: 90, product_id: "pr" }],
      "c1",
      "o1"
    );
    assert.equal(soProduto.length, 0);
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
    assert.match(perfil, /oferecerAgendaAposAceite/);
    assert.match(perfil, /createAgendaSlots/);
    assert.doesNotMatch(perfil, /sendWhatsapp\(.*aceite/);
    assert.match(agenda, /valorFinanceiroNaBaixa/);
    assert.match(agenda, /consumirSessao/);
    assert.match(agenda, /oferecerProximaSessaoAposBaixa/);
    assert.match(agenda, /createProtocoloAplicado/);
    assert.match(agenda, /openDarBaixaModal\(item\)/);
    assert.doesNotMatch(agenda, /auto.?pric/i);
    assert.match(sql, /orcamento_id/);
    assert.match(sql, /idx_package_consumptions_agenda_unica/);
    assert.doesNotMatch(perfil, /client_packages2/);
  });

  it("aceite sugere horários na agenda sem mudar preço", () => {
    const sessoes = sessoesDoPacoteParaAgenda(
      { id: "pk", nome_pacote: "HIFU facial", total_sessoes: 4, procedure_id: "p1", client_id: "c1" },
      { id: "p1", name: "HIFU facial", duration_minutes: 60 }
    );
    assert.equal(sessoes.length, 4);
    const soPrimeira = slotsAgendaDoAceite({
      packages: [{ id: "pk", nome_pacote: "HIFU facial", total_sessoes: 4, procedure_id: "p1" }],
      procedures: [{ id: "p1", name: "HIFU facial", duration_minutes: 60 }],
      startDate: "2026-10-10",
      startTime: "09:00",
      onlyFirst: true,
    });
    assert.equal(soPrimeira.length, 1);
    assert.equal(soPrimeira[0].data, "2026-10-10");
    const todas = slotsAgendaDoAceite({
      packages: [{ id: "pk", nome_pacote: "HIFU facial", total_sessoes: 4, procedure_id: "p1" }],
      procedures: [{ id: "p1", name: "HIFU facial", duration_minutes: 60 }],
      startDate: "2026-10-10",
      startTime: "09:00",
      intervalDays: 7,
      onlyFirst: false,
    });
    assert.equal(todas.length, 4);
    assert.equal(todas[3].data, "2026-10-31");
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(agenda, /agendaDefaultDate/);
  });

  it("baixa com saldo de pacote sugere próxima, sem WhatsApp automático", () => {
    assert.equal(addDaysIso("2026-09-26", 7), "2026-10-03");
    const sim = sugerirProximaAcaoNaBaixa({
      sessoesRestantes: 3,
      temAgendaFutura: false,
      dataAtual: "2026-09-26",
    });
    assert.equal(sim.oferecer, true);
    assert.equal(sim.dataSugerida, "2026-10-03");
    assert.equal(sugerirProximaAcaoNaBaixa({ sessoesRestantes: 3, temAgendaFutura: true }).oferecer, false);
    assert.equal(sugerirProximaAcaoNaBaixa({ sessoesRestantes: 0, temAgendaFutura: false }).oferecer, false);
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(agenda, /WhatsApp não sai sozinho/);
  });
});
