/**
 * Lote 33 — régua WhatsApp e silêncio humano. Sem disparo em massa.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  payloadSilencio,
  mapaSilencioPorCliente,
  estaEmSilencio,
  proximoPassoRegua,
  PREFIXO_SILENCIO,
} from "../js/utils/whatsapp-regua.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("regua e silencio whatsapp", () => {
  it("silêncio vence; off e data vencida liberam; régua não envia sozinha", () => {
    const p = payloadSilencio("c1");
    assert.equal(p.event_type, "whatsapp_silencio");
    assert.equal(p.description, `${PREFIXO_SILENCIO}indefinido`);
    const map = mapaSilencioPorCliente(
      [
        { client_id: "c1", event_type: "whatsapp_silencio", description: "whatsapp_silencio:indefinido", created_at: "2026-01-01" },
        { client_id: "c1", event_type: "whatsapp_silencio", description: "whatsapp_silencio:off", created_at: "2026-02-01" },
      ],
      "2026-09-26"
    );
    assert.equal(estaEmSilencio(map, "c1"), false);
    const ate = mapaSilencioPorCliente(
      [{ client_id: "c2", event_type: "whatsapp_silencio", description: "whatsapp_silencio:2026-01-01", created_at: "2026-01-01" }],
      "2026-09-26"
    );
    assert.equal(estaEmSilencio(ate, "c2"), false);
    const passo = proximoPassoRegua("aberto_wa:agenda_lembrete", false);
    assert.equal(passo.id, "lembrete_2");
    assert.equal(passo.enviar, false);
    const quieto = proximoPassoRegua("", true);
    assert.equal(quieto.enviar, false);
  });

  it("CRM e API respeitam silêncio; lembrete automático não manda WhatsApp", () => {
    const crm = readFileSync(join(ROOT, "js/views/crm.views.js"), "utf8");
    const send = readFileSync(join(ROOT, "js/services/whatsapp.service.js"), "utf8");
    const api = readFileSync(join(ROOT, "routes/whatsapp-send.js"), "utf8");
    const cron = readFileSync(join(ROOT, "routes/lembretes-auto.js"), "utf8");
    assert.match(crm, /crm-silencio/);
    assert.match(crm, /payloadSilencio/);
    assert.match(send, /via: "silencio"/);
    assert.match(api, /silencio_humano/);
    assert.match(cron, /silencio_humano/);
    const wa = [...crm.matchAll(/class="[^"]*\bcrm-wa\b/g)];
    assert.equal(wa.length, 2);
  });
});
