/**
 * Lote 27 — combinado da consulta no prontuário.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  payloadCombinadoConsulta,
  sanitizarCombinado,
  tituloCombinadoNaLinha,
  TIPO_COMBINADO,
  COMBINADO_MAX,
} from "../js/utils/consulta-combinado.js";
import { montarLinhaDoTempo } from "../js/utils/linha-tempo.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("combinado da consulta", () => {
  it("corta texto, recusa ia_preliminar e não inventa metadata extra", () => {
    assert.equal(sanitizarCombinado("ia_preliminar secreto"), "");
    assert.equal(sanitizarCombinado("a".repeat(500)).length, COMBINADO_MAX);
    assert.equal(payloadCombinadoConsulta({ proximoPasso: "   " }), null);
    const p = payloadCombinadoConsulta({
      proximoPasso: "Retorno em 15 dias",
      retornoEm: "2026-10-10",
      agendaId: "ag1",
    });
    assert.equal(p.event_type, TIPO_COMBINADO);
    assert.equal(p.metadata.retorno_em, "2026-10-10");
    assert.equal(p.created_by_client, false);
    assert.equal(tituloCombinadoNaLinha(TIPO_COMBINADO), "Combinado na consulta");
    const items = montarLinhaDoTempo({
      events: [{ event_type: TIPO_COMBINADO, description: "Voltar em 15 dias", event_date: "2026-09-26" }],
    });
    assert.equal(items[0].titulo, "Combinado na consulta");
  });

  it("baixa e perfil gravam no client_events, sem tabela nova", () => {
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    const perfil = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(agenda, /payloadCombinadoConsulta/);
    assert.match(perfil, /btnRegistrarCombinado/);
    assert.doesNotMatch(agenda, /client_events2/);
  });
});
