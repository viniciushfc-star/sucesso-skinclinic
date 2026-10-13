/**
 * Lote 74 — cenários Clinic OS (Ana/Bianca, ficha, portal, login).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import { credenciaisGoldenAuth } from "../js/utils/golden-flow-auth.js";
import {
  roteiroHumanoCicloOs,
  roteiroProgramadorCicloOs,
  cenarioAnaVendeBiancaAplica,
  cenarioMesmaPessoaVendeEAplica,
  cenarioCicloOleosidadeFeito,
  cenarioIaSemPreliminar,
  cenarioPortalProximoHorario,
  cenarioLinkPadraoNoCadastro,
  cenarioSenhaPortal,
} from "../js/utils/cenario-ciclo-os.js";
import { runCenariosCicloOs } from "./cenario-ciclo-os.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const creds = credenciaisGoldenAuth();

describe("Lote 74 cenários Clinic OS", () => {
  it("roteiro humano cobre clínica e portal; Ana ≠ Bianca", () => {
    const ids = roteiroHumanoCicloOs().map((p) => p.id);
    assert.ok(ids.includes("h-cadastro-link"));
    assert.ok(ids.includes("h-agenda-vendeu"));
    assert.ok(ids.includes("h-portal-login"));
    const ana = cenarioAnaVendeBiancaAplica();
    assert.equal(ana.aplica, "bianca");
    assert.equal(ana.vendeu, "ana");
    assert.equal(ana.misturou, false);
    assert.equal(ana.pagaSozinho, false);
    const mesma = cenarioMesmaPessoaVendeEAplica();
    assert.equal(mesma.aplica, mesma.vendeu);
    const ciclo = cenarioCicloOleosidadeFeito();
    assert.equal(ciclo.linha.combinado, "Oleosidade");
    assert.equal(ciclo.linha.feito, "Limpeza profunda");
    const ia = cenarioIaSemPreliminar();
    assert.equal(ia.temFonte, false);
    assert.equal(JSON.stringify(ia.payload).includes("ia_preliminar"), false);
    const card = cenarioPortalProximoHorario();
    assert.equal(card.tipo, "horario");
    assert.equal(cenarioLinkPadraoNoCadastro(), true);
    const senha = cenarioSenhaPortal();
    assert.equal(senha.ok, true);
    assert.equal(senha.curta, false);
    assert.equal(senha.email, "ana@ex.com");
  });

  it("script ao vivo não dispara WhatsApp nem muda preço; sem Atendimentos", () => {
    const src = readFileSync(join(ROOT, "scripts/cenario-ciclo-os.js"), "utf8");
    assert.doesNotMatch(src, /sendWhatsapp|whatsapp-send/i);
    assert.doesNotMatch(src, /\.update\(/);
    assert.doesNotMatch(src, /view-atendimentos|#atendimentos/);
    const ids = roteiroProgramadorCicloOs().map((p) => p.id);
    assert.ok(ids.includes("sql_quem_vendeu"));
    assert.ok(ids.includes("sql_portal_login"));
  });

  it("percorre os cenários ao vivo (JWT)", { skip: !creds.ok }, async () => {
    const r = await runCenariosCicloOs();
    assert.equal(r.pulou, false);
    assert.equal(r.ok, true);
    const estados = new Set(r.passos.map((p) => p.estado));
    assert.equal(estados.has("FALHOU"), false);
    assert.equal(estados.has("TRAVOU"), false);
  });
});
