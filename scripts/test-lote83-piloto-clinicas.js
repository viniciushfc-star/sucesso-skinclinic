/**
 * Lote 83 — pacote piloto por papel (cliente, master, contador…).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { credenciaisGoldenAuth } from "../js/utils/golden-flow-auth.js";
import {
  PAPEIS_PILOTO,
  expectativasPapel,
  roteiroPilotoClinica,
  telasDoPapel,
} from "../js/utils/cenario-papeis.js";
import { runPilotoClinicas } from "./cenario-piloto-clinicas.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const creds = credenciaisGoldenAuth();

describe("Lote 83 piloto clínicas por papel", () => {
  it("roteiro cobre cliente, master, gestor, recepção, profissional, funcionário e contador", () => {
    const ids = PAPEIS_PILOTO.map((p) => p.id);
    for (const k of ["cliente", "master", "gestor", "recepcao", "profissional", "funcionario", "contador"]) {
      assert.ok(ids.includes(k), k);
    }
    const humano = roteiroPilotoClinica().map((b) => b.papel);
    assert.deepEqual(humano.sort(), ids.sort());
    const master = telasDoPapel("master");
    assert.ok(master.includes("financeiro"));
    assert.ok(master.includes("contador"));
    const rec = expectativasPapel().recepcao;
    const telasR = telasDoPapel("recepcao");
    for (const v of rec.nao) assert.equal(telasR.includes(v), false);
    const md = readFileSync(join(ROOT, "docs/PILOTO-CLINICAS-ROTEIRO.md"), "utf8");
    assert.match(md, /portal\.html/);
    assert.match(md, /aba Contador/);
    assert.doesNotMatch(md, /ia_preliminar no portal/i);
    const src = readFileSync(join(ROOT, "scripts/cenario-piloto-clinicas.js"), "utf8");
    assert.doesNotMatch(src, /sendWhatsapp/);
  });

  it("piloto ao vivo agrega papéis + ciclo + usuário", { skip: !creds.ok }, async () => {
    const r = await runPilotoClinicas();
    const falhou = (r.passos || []).filter((p) => p.estado === "FALHOU" || p.estado === "TRAVOU");
    assert.equal(falhou.length, 0, falhou.map((p) => `${p.id}:${p.detalhe}`).join(" | "));
    assert.equal(r.ok, true);
  });
});
