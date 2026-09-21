/**
 * P2-3 — fila CRM: uma pessoa, WhatsApp só no clique.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCrmFila, prioridadeSinal, filaWhatsappTemplate } from "../js/utils/crm-fila.js";

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
});
