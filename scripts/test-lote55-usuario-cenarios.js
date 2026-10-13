/**
 * Lote 55 — cenários de uso (dona da clínica) + trava por timeout.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cenarioNovaSemSegundo,
  cenarioPacoteJaAgendado,
  cenarioAtrasadaRitmo,
  cenarioSetupEmpresaPendente,
  roteiroUsuarioClinica,
  withTimeout,
} from "../js/utils/cenario-usuario.js";
import { runCenariosUsuario } from "./cenario-usuario-clinica.js";
import "dotenv/config";
import { credenciaisGoldenAuth } from "../js/utils/golden-flow-auth.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const creds = credenciaisGoldenAuth();

describe("Lote 55 cenários de usuário", () => {
  it("roteiro cobre Hoje, setup, radar e espera sem WhatsApp automático", () => {
    const ids = roteiroUsuarioClinica().map((p) => p.id);
    assert.ok(ids.includes("hoje_agenda"));
    assert.ok(ids.includes("setup_primeiro_dia"));
    assert.ok(ids.includes("radar_retorno"));
    assert.ok(ids.includes("espera_opcional"));
    assert.equal(cenarioNovaSemSegundo().sinal, "nova_sem_2");
    assert.equal(cenarioPacoteJaAgendado().sinal, null);
    assert.equal(cenarioAtrasadaRitmo().sinal, "atrasada");
    assert.equal(cenarioSetupEmpresaPendente().id, "empresa");
    const src = readFileSync(join(ROOT, "scripts/cenario-usuario-clinica.js"), "utf8");
    assert.doesNotMatch(src, /sendWhatsapp|whatsapp-send/i);
    assert.doesNotMatch(src, /update\(.*valor_cobrado/i);
  });

  it("timeout marca trava, não espera para sempre", async () => {
    await assert.rejects(
      () => withTimeout(new Promise(() => {}), 30, "demo"),
      /TRAVOU: demo/
    );
  });

  it("usuário master percorre os cenários ao vivo", { skip: !creds.ok }, async () => {
    const r = await runCenariosUsuario();
    assert.equal(r.pulou, false);
    const travou = (r.passos || []).filter((p) => p.estado === "TRAVOU");
    assert.equal(travou.length, 0, travou.map((p) => p.id).join(","));
    const falhou = (r.passos || []).filter((p) => p.estado === "FALHOU");
    assert.equal(falhou.length, 0, falhou.map((p) => `${p.id}:${p.detalhe}`).join(" | "));
    assert.equal(r.ok, true);
  });
});
