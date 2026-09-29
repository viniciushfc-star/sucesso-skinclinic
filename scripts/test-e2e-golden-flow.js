/**
 * Wrapper node:test da suíte E2E do Golden Flow.
 * Sem credencial: todos os passos NÃO COMPROVADO (não falha o teste).
 * Com credencial: FALHOU em passo automático quebra o teste.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { runGoldenFlowE2E } from "./e2e-golden-flow.js";
import { credenciaisGoldenAuth } from "../js/utils/golden-flow-auth.js";

describe("E2E Golden Flow integrado", () => {
  it("grava e lê o ciclo com JWT da clínica (não é grep nem HTTP de página)", async () => {
    const rel = await runGoldenFlowE2E();
    const creds = credenciaisGoldenAuth();
    for (const p of rel.passos) {
      assert.ok(["COMPROVADO", "NÃO COMPROVADO", "FALHOU", "pendente"].includes(p.estado), p.id);
    }
    if (!creds.ok || rel.skippedCredenciais) {
      assert.ok(rel.passos.every((p) => p.estado === "NÃO COMPROVADO"));
      return;
    }
    const falhas = rel.passos.filter((p) => p.auto && p.estado === "FALHOU");
    assert.equal(falhas.length, 0, falhas.map((f) => `${f.id}: ${f.detalhe}`).join(" | "));
    assert.equal(rel.passos.find((p) => p.id === "ui-browser")?.estado, "NÃO COMPROVADO");
  });
});
