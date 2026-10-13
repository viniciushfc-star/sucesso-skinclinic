/**
 * Lote 60 — Relacionamento: pacote/plano encerrado sem próximo horário.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classificarSinalRadar, prioridadeSinal, filaWhatsappTemplate, buildCrmFila } from "../js/utils/crm-fila.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 60 CRM plano encerrado", () => {
  it("plano encerrado entra na fila acima de inativa e abaixo de pacote aberto", () => {
    assert.ok(prioridadeSinal("pacote") > prioridadeSinal("plano_fim"));
    assert.ok(prioridadeSinal("plano_fim") > prioridadeSinal("espera"));
    const fila = buildCrmFila([
      { clientId: "a", name: "Ana", sinal: "inativa" },
      { clientId: "a", name: "Ana", sinal: "plano_fim" },
    ]);
    assert.equal(fila[0].sinal, "plano_fim");
    const r = classificarSinalRadar({ packEnded: true, packNome: "6 sessões", visits: 6, idleDays: 3 });
    assert.equal(r.sinal, "plano_fim");
    assert.match(r.motivo, /6 sessões/);
    assert.match(r.acao, /Agendar/);
  });

  it("WhatsApp do plano encerrado é um clique, não campanha", () => {
    const t = filaWhatsappTemplate({ name: "Bia", sinal: "plano_fim", clinic: "Skin" });
    assert.match(t, /Bia/);
    assert.match(t, /manutenção/);
    assert.doesNotMatch(t, /lista de/);
    const crm = readFileSync(join(ROOT, "js/services/crm.service.js"), "utf8");
    assert.match(crm, /packEnded/);
    assert.match(crm, /listPacotesByOrg\(\)/);
    assert.doesNotMatch(crm, /listPacotesByOrg\(\{\s*only_with_balance:\s*true/);
    const view = readFileSync(join(ROOT, "js/views/crm.views.js"), "utf8");
    assert.match(view, /plano_fim/);
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(html, /data-radar="plano_fim"/);
    assert.doesNotMatch(view, /sendWhatsapp\([^)]+,\s*true/);
  });
});
