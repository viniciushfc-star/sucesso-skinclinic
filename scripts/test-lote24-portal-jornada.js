/**
 * Lote 24 — jornada do portal: plano, orientações e próximo passo.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { nomePlanoPortal, proximoPassoJornada, jornadaJsonProibido } from "../js/utils/portal-jornada.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("portal jornada plano e próximo passo", () => {
  it("não usa nome com ia_preliminar e prioriza o horário marcado", () => {
    assert.equal(nomePlanoPortal({ name: "Laser" }), "Laser");
    assert.equal(nomePlanoPortal({ name: "ia_preliminar x" }), "");
    const comAgenda = proximoPassoJornada({
      today: "2026-09-26",
      cadastroCompleto: false,
      sessoes: [{ data: "2026-09-28", hora: "14:00" }],
    });
    assert.match(comAgenda.detalhe, /2026-09-28/);
    const sem = proximoPassoJornada({ today: "2026-09-26", cadastroCompleto: false });
    assert.equal(sem.hash, "completar-cadastro");
    assert.equal(jornadaJsonProibido([{ detalhe: "ok" }]), false);
  });

  it("dashboard passa protocolo e records para a jornada", () => {
    const dash = readFileSync(join(ROOT, "js/Client/dashboard.client.js"), "utf8");
    assert.match(dash, /protocol,/);
    assert.match(dash, /records: records/);
    assert.doesNotMatch(dash, /ia_preliminar/);
  });
});
