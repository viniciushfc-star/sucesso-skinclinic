/**
 * Lote 4 — ciclo ouro: arquivos e checklist de setup.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GOLDEN_CYCLE, SETUP_STEP_IDS } from "../js/utils/golden-flow.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 4 golden flow", () => {
  it("cada elo do ciclo tem view e service no repo", () => {
    for (const step of GOLDEN_CYCLE) {
      assert.equal(existsSync(join(ROOT, "js/views", step.view)), true, step.view);
      assert.equal(existsSync(join(ROOT, "js/services", step.service)), true, step.service);
    }
    assert.equal(GOLDEN_CYCLE.length, 11);
  });

  it("setup progress cobre 10 passos até financeiro e aplicado", () => {
    const src = readFileSync(join(ROOT, "js/services/setup-progress.service.js"), "utf8");
    for (const id of SETUP_STEP_IDS) {
      assert.match(src, new RegExp(`id: "${id}"`));
    }
    assert.match(src, /anamnesis_registros/);
    assert.match(src, /planos_terapeuticos/);
    assert.match(src, /protocolos_aplicados/);
    assert.match(src, /SETUP_STEP_MINUTES/);
  });

  it("aplicar protocolo dispara consumo no SQL canônico e no service", () => {
    const sql = readFileSync(join(ROOT, "supabase/supabase-protocolo-canon.sql"), "utf8");
    assert.match(sql, /estoque_consumo_ao_aplicar_protocolo/);
    assert.match(sql, /trg_estoque_consumo_ao_aplicar_protocolo/);
    const svc = readFileSync(join(ROOT, "js/services/protocolo-db.service.js"), "utf8");
    assert.match(svc, /registrarConsumoEstimado/);
    assert.match(svc, /protocolos_aplicados/);
  });

  it("P&L e lucro/hora não mandam alterar preço", () => {
    const pl = readFileSync(join(ROOT, "js/services/procedimento-pl.service.js"), "utf8");
    const lh = readFileSync(join(ROOT, "js/utils/lucro-hora.js"), "utf8");
    const intel = readFileSync(join(ROOT, "js/services/intelligence.service.js"), "utf8");
    assert.doesNotMatch(pl, /altere o preço automaticamente/i);
    assert.match(lh, /não altera o preço/i);
    assert.doesNotMatch(intel, /sendWhatsapp/);
  });
});
