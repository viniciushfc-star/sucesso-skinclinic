/**
 * Lote 64 — portal do paciente: jornada em evidência, tokens da clínica, sem ia_preliminar.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPortalJornada, nomePlanoPortal, jornadaJsonProibido } from "../js/utils/portal-jornada.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 64 portal UX clínica", () => {
  it("html usa papel/teal e não o azul de template", () => {
    const html = readFileSync(join(ROOT, "portal.html"), "utf8");
    assert.match(html, /portal-app/);
    assert.match(html, /#0f5c62/);
    assert.doesNotMatch(html, /#16213e|#0ea5e9/);
    assert.match(html, /portal-mais/);
    const css = readFileSync(join(ROOT, "js/css/style.css"), "utf8");
    assert.match(css, /body:not\(:has\(\.app-wrapper\)\):not\(\.portal-app\)/);
  });

  it("dashboard esconde o menu extra; jornada continua o centro", () => {
    const dash = readFileSync(join(ROOT, "js/Client/dashboard.client.js"), "utf8");
    assert.match(dash, /Minha jornada/);
    assert.match(dash, /portal-mais/);
    assert.match(dash, /btnAgendaPortal/);
    assert.doesNotMatch(dash, /ia_preliminar/);
    assert.doesNotMatch(dash, /view-atendimentos|#atendimentos/);
  });

  it("plano na jornada aceita nome combinado e recusa preliminar", () => {
    assert.equal(nomePlanoPortal("QA ciclo ouro"), "QA ciclo ouro");
    assert.equal(nomePlanoPortal("ia_preliminar x"), "");
    const steps = buildPortalJornada({
      today: "2026-10-11",
      cadastroCompleto: true,
      planoNome: "QA ciclo ouro",
      protocol: { ia_preliminar: "SEGREDO" },
    });
    assert.equal(steps.find((s) => s.id === "plano")?.detalhe, "QA ciclo ouro");
    assert.equal(jornadaJsonProibido(steps), false);
  });
});
