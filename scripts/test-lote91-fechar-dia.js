/**
 * Lote 91 — fechar o dia (humano confirma) e lembrete opt-in (cron não manda WA).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  amanhaIso,
  pendentesLembrete,
  montarFecharDia,
  payloadAuditoriaFecharDia,
} from "../js/utils/fechar-dia.js";
import { decisaoWhatsappLembrete } from "../routes/lembretes-auto.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 91 fechar o dia", () => {
  it("previsto vs recebido, sem lançar; amanhã e pendente de lembrete", () => {
    assert.equal(amanhaIso("2026-10-13"), "2026-10-14");
    const aberto = montarFecharDia({
      data: "2026-10-13",
      hojeCount: 4,
      previsto: 800,
      recebido: 200,
      atrasos: 1,
    });
    assert.equal(aberto.status, "aberto");
    assert.equal(aberto.gap, 600);
    assert.match(aberto.lead, /Confirmar não lança/);
    const ok = montarFecharDia({
      data: "2026-10-13",
      hojeCount: 2,
      previsto: 100,
      recebido: 100,
      atrasos: 0,
    });
    assert.equal(ok.status, "ok");
    const vazio = montarFecharDia({});
    assert.equal(vazio.status, "vazio");
    const payload = payloadAuditoriaFecharDia(aberto);
    assert.equal(payload.previsto, 800);
    assert.equal(payload.recebido, 200);
    const pend = pendentesLembrete([
      { reminder_sent_at: null, confirmed_at: null },
      { reminder_sent_at: "2026-10-12", confirmed_at: null },
      { confirmed_at: "2026-10-12" },
      { item_type: "event" },
      { cancelled_at: "x" },
    ]);
    assert.equal(pend.length, 1);
  });

  it("lote e cron não enviam WhatsApp; clique humano ainda pode", () => {
    const lote = decisaoWhatsappLembrete({ temTelefone: true, origem: "lote" });
    assert.equal(lote.enviar, false);
    assert.equal(lote.reason, "humano_clica");
    const cron = decisaoWhatsappLembrete({ temTelefone: true, origem: "cron" });
    assert.equal(cron.enviar, false);
    const clique = decisaoWhatsappLembrete({ temTelefone: true, origem: "clique" });
    assert.equal(clique.enviar, true);
    const src = readFileSync(join(ROOT, "routes/lembretes-auto.js"), "utf8");
    assert.match(src, /origem: "lote"/);
    assert.match(src, /humano_clica/);
  });

  it("Hoje mostra fechar o dia e lembrete; SPA e cron alinhados", () => {
    const dash = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(dash, /cockpitFecharDia/);
    const view = readFileSync(join(ROOT, "js/views/dashboard.views.js"), "utf8");
    assert.match(view, /renderFecharDia/);
    assert.match(view, /operacao\.fechar_dia/);
    assert.match(view, /Nenhum lançamento extra/);
    assert.match(view, /data-financeiro-tab="fechamento"/);
    assert.doesNotMatch(view, /view-atendimentos|#atendimentos/);
    const cock = readFileSync(join(ROOT, "js/services/cockpit.service.js"), "utf8");
    assert.match(cock, /montarFecharDia/);
    assert.match(cock, /pendentesLembrete/);
    const spa = readFileSync(join(ROOT, "js/core/spa.js"), "utf8");
    assert.match(spa, /produto-posse-1/);
  });
});
