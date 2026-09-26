/**
 * P2-3 — fila CRM: uma pessoa, WhatsApp só no clique.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCrmFila, prioridadeSinal, filaWhatsappTemplate, payloadDesfecho, mapaUltimoDesfecho, filtrarFilaPorDesfecho } from "../js/utils/crm-fila.js";

describe("P2-3 fila CRM WhatsApp", () => {
  it("uma pessoa na fila mesmo com dois sinais", () => {
    const fila = buildCrmFila([
      { clientId: "a", name: "Ana", phone: "11999999999", sinal: "inativa" },
      { clientId: "a", name: "Ana", phone: "11999999999", sinal: "pacote" },
    ]);
    assert.equal(fila.length, 1);
    assert.equal(fila[0].sinal, "pacote");
  });

  it("pacote ganha de inativa", () => {
    assert.ok(prioridadeSinal("pacote") > prioridadeSinal("inativa"));
  });

  it("teto 15", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      clientId: `id${i}`,
      name: `P${i}`,
      phone: `1199999${String(i).padStart(4, "0")}`,
      sinal: "atrasada",
    }));
    assert.equal(buildCrmFila(many).length, 15);
  });

  it("template não é campanha em massa", () => {
    const t = filaWhatsappTemplate({ name: "Bia", sinal: "pacote", clinic: "Skin", agendarUrl: "https://x/agendar" });
    assert.match(t, /Bia/);
    assert.doesNotMatch(t, /lista de/);
  });

  it("sendWhatsapp não aceita array de destinos", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../js/services/whatsapp.service.js"),
      "utf8"
    );
    assert.match(src, /um telefone por chamada/);
    assert.equal(src.includes(".forEach"), false);
  });

  it("desfecho some da fila se não quis ou agendou, sem WhatsApp automático", () => {
    const p = payloadDesfecho({ clientId: "c1", sinal: "pacote", desfecho: "nao_quis", hoje: "2026-09-26" });
    assert.equal(p.event_type, "crm_desfecho");
    assert.equal(p.metadata.desfecho, "nao_quis");
    assert.equal(payloadDesfecho({ clientId: "", desfecho: "falei" }), null);
    const map = mapaUltimoDesfecho([
      { client_id: "c1", event_type: "crm_desfecho", event_date: "2026-09-20", metadata: { desfecho: "nao_quis" } },
    ]);
    const fila = [
      { clientId: "c1", name: "Ana", sinal: "pacote" },
      { clientId: "c2", name: "Bia", sinal: "inativa" },
    ];
    const out = filtrarFilaPorDesfecho(fila, map, "2026-09-26");
    assert.equal(out.length, 1);
    assert.equal(out[0].clientId, "c2");
    const ainda = filtrarFilaPorDesfecho(fila, mapaUltimoDesfecho([
      { client_id: "c1", event_type: "crm_desfecho", event_date: "2026-09-26", metadata: { desfecho: "nao_respondeu" } },
    ]), "2026-09-26");
    assert.equal(ainda.some((x) => x.clientId === "c1"), true);
    const crmView = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../js/views/crm.views.js"), "utf8");
    assert.match(crmView, /crm-desfecho/);
    assert.match(crmView, /createClientEvent/);
    assert.doesNotMatch(crmView, /crm2/);
  });
});
