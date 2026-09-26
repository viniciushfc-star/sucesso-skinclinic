/**
 * Lote 29 — origem do lead no client_events e na espera. Sem crm2. CAC só com investimento.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  payloadLeadOrigem,
  mapaOrigemPorCliente,
  origemDaNotaEspera,
  notesComOrigem,
  idsConvertidosDesfecho,
  resumirFunilOrigem,
  PREFIXO_LEAD_ORIGEM,
} from "../js/utils/crm-origem.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("origem do lead", () => {
  it("primeira origem vence; CAC fica vazio sem investimento", () => {
    const p = payloadLeadOrigem("c1", "instagram");
    assert.equal(p.event_type, "lead_origem");
    assert.equal(p.description, `${PREFIXO_LEAD_ORIGEM}instagram`);
    const map = mapaOrigemPorCliente([
      { client_id: "c1", event_type: "lead_origem", description: "lead_origem:instagram" },
      { client_id: "c1", event_type: "lead_origem", description: "lead_origem:google" },
    ]);
    assert.equal(map.get("c1"), "instagram");
    assert.equal(origemDaNotaEspera("[origem:indicacao] quer manhã"), "indicacao");
    assert.equal(notesComOrigem("", "google"), "[origem:google]");
    const conv = idsConvertidosDesfecho([
      { client_id: "c1", event_type: "crm_desfecho", metadata: { desfecho: "agendou" } },
    ]);
    const semCac = resumirFunilOrigem({ origemByClient: map, convertidos: conv });
    assert.equal(semCac.cac, null);
    const comCac = resumirFunilOrigem({ origemByClient: map, convertidos: conv, investimento: 200 });
    assert.equal(comCac.cac, 200);
  });

  it("CRM usa client_events e espera, sem crm2", () => {
    const view = readFileSync(join(ROOT, "js/views/crm.views.js"), "utf8");
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    const svc = readFileSync(join(ROOT, "js/services/client-events.service.js"), "utf8");
    assert.match(view, /payloadLeadOrigem/);
    assert.match(view, /notesComOrigem/);
    assert.match(html, /crmEsperaOrigem/);
    assert.match(html, /crmInvestimentoOrigem/);
    assert.match(svc, /lead_origem/);
    assert.doesNotMatch(view, /crm2/);
    assert.doesNotMatch(html, /from\s*\(\s*["']crm2/);
  });
});
