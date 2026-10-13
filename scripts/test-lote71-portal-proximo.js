/**
 * Lote 71 — portal: próximo horário em evidência; sessões; evolução; sem ia_preliminar.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cartaoProximoPortal,
  resumoSessoesPortal,
  dataHoraPortal,
  jornadaJsonProibido,
  buildPortalJornada,
} from "../js/utils/portal-jornada.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 71 portal próximo horário", () => {
  it("cartão mostra horário em pt-BR e recusa preliminar", () => {
    assert.equal(dataHoraPortal("2026-10-20", "14:00:00"), "20/10/2026 às 14:00");
    const card = cartaoProximoPortal({
      today: "2026-10-12",
      cadastroCompleto: true,
      analises: [{ ia_preliminar: "SEGREDO", texto_validado: null }],
      sessoes: [{ data: "2026-10-20", hora: "14:00:00", procedimento: "Limpeza" }],
    });
    assert.equal(card.tipo, "horario");
    assert.equal(card.hash, "agenda");
    assert.match(card.titulo, /20\/10\/2026/);
    assert.equal(card.detalhe, "Limpeza");
    assert.equal(JSON.stringify(card).includes("ia_preliminar"), false);
    assert.equal(jornadaJsonProibido(buildPortalJornada({
      today: "2026-10-12",
      analises: [{ ia_preliminar: "SEGREDO" }],
    })), false);
  });

  it("sem horário o cartão vira o próximo passo; resumo conta sessões", () => {
    const card = cartaoProximoPortal({
      today: "2026-10-12",
      cadastroCompleto: false,
      sessoes: [],
    });
    assert.equal(card.tipo, "pendente");
    assert.equal(card.hash, "completar-cadastro");
    const r = resumoSessoesPortal({
      today: "2026-10-12",
      sessoes: [
        { data: "2026-09-01", hora: "10:00" },
        { data: "2026-10-20", hora: "14:00" },
      ],
    });
    assert.equal(r.passadas, 1);
    assert.equal(r.futuras, 1);
    assert.match(r.texto, /realizada/);
  });

  it("dashboard destaca horário e evolução fora do menu extra", () => {
    const dash = readFileSync(join(ROOT, "js/Client/dashboard.client.js"), "utf8");
    assert.match(dash, /portal-proximo/);
    assert.match(dash, /btnPortalProximo/);
    assert.match(dash, /portal-acoes-principais/);
    assert.match(dash, /cartaoProximoPortal/);
    const mais = dash.slice(dash.indexOf("portal-mais"), dash.indexOf("relatoEventoForm"));
    assert.doesNotMatch(mais, /id="btnEvolucao"/);
    assert.match(dash, /id="btnEvolucao"/);
    assert.doesNotMatch(dash, /ia_preliminar/);
    assert.doesNotMatch(dash, /view-atendimentos|#atendimentos/);
    const html = readFileSync(join(ROOT, "portal.html"), "utf8");
    assert.match(html, /style\.css\?v=portal-ux-3/);
    assert.match(html, /portal-proximo/);
  });
});
