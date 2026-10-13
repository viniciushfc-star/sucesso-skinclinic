/**
 * Lote 56 — papéis (funcionário, recepção, profissional), portal do cliente, aba contador.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { telasDoPapel, expectativasPapel } from "../js/utils/cenario-papeis.js";
import { permissionAllowedByRoleForTest } from "../lib/api-auth.js";
import { relatorioContadorToReadable } from "../js/utils/contador-report.js";
import { credenciaisGoldenAuth } from "../js/utils/golden-flow-auth.js";
import { runCenariosPapeis } from "./cenario-papeis.js";
import "dotenv/config";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const creds = credenciaisGoldenAuth();

describe("Lote 56 papéis, portal e contador", () => {
  it("mapa de telas: recepção sem financeiro; funcionário sem CRM; profissional sem WhatsApp", () => {
    const exp = expectativasPapel();
    for (const [papel, regra] of Object.entries(exp)) {
      const telas = telasDoPapel(papel);
      for (const v of regra.tem) assert.ok(telas.includes(v), `${papel} deveria ver ${v}`);
      for (const v of regra.nao) assert.equal(telas.includes(v), false, `${papel} não deveria ver ${v}`);
    }
    assert.equal(permissionAllowedByRoleForTest("recepcao", "financeiro:view"), false);
    assert.equal(permissionAllowedByRoleForTest("recepcao", "whatsapp:send"), true);
    assert.equal(permissionAllowedByRoleForTest("profissional", "whatsapp:send"), false);
    assert.equal(permissionAllowedByRoleForTest("funcionario", "clientes:manage"), false);
    assert.ok(telasDoPapel("master").includes("contador"));
    assert.equal(telasDoPapel("viewer").includes("financeiro"), false);
    const spa = readFileSync(join(ROOT, "js/core/spa.js"), "utf8");
    assert.match(spa, /financeiro:view/);
    assert.match(spa, /clientes:manage/);
  });

  it("aba contador e portal não levam ia_preliminar", () => {
    const rel = relatorioContadorToReadable({
      clientes: [],
      totais: { entradas: 0, saidas: 0, clientesAtivos: 0 },
      periodo: { dataInicio: "2026-10-01", dataFim: "2026-10-31" },
    });
    const txt = String(rel?.text || "");
    assert.match(txt, /contador/i);
    assert.doesNotMatch(txt, /ia_preliminar/);
    assert.doesNotMatch(String(rel?.html || ""), /ia_preliminar/);
    const portal = readFileSync(join(ROOT, "portal.html"), "utf8");
    assert.match(portal, /portal\.js|Client/);
    const dash = readFileSync(join(ROOT, "js/Client/dashboard.client.js"), "utf8");
    assert.doesNotMatch(dash, /ia_preliminar/);
  });

  it("logins QA + API + portal RPC ao vivo", { skip: !creds.ok }, async () => {
    const r = await runCenariosPapeis();
    const falhou = (r.passos || []).filter((p) => p.estado === "FALHOU" || p.estado === "TRAVOU");
    assert.equal(falhou.length, 0, falhou.map((p) => `${p.id}:${p.detalhe}`).join(" | "));
  });
});
