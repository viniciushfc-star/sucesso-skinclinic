/**
 * Lote 7 — portal e análise de pele: cliente não vê rascunho da IA;
 * skincare e anamnese só com texto validado.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analisesPeleParaSkincare,
  conteudoAnamneseDaAnalise,
  publicSubmitAnaliseBody,
  sanitizePortalAnaliseRow,
} from "../lib/analise-pele-storage.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 7 portal e pele", () => {
  it("skincare ignora pendente e nunca copia ia_preliminar", () => {
    const out = analisesPeleParaSkincare([
      { status: "pending_validation", ia_preliminar: "SEGREDO", texto_validado: null, created_at: "a" },
      { status: "validated", ia_preliminar: "SEGREDO", texto_validado: "ok clinico", created_at: "b" },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].texto_validado, "ok clinico");
    assert.equal("ia_preliminar" in out[0], false);
    assert.doesNotMatch(JSON.stringify(out), /SEGREDO/);
  });

  it("anamnese incorporada não leva o rascunho da IA", () => {
    const comTexto = conteudoAnamneseDaAnalise({
      ia_preliminar: "SEGREDO",
      texto_validado: "Devolutiva humana",
    });
    assert.equal(comTexto, "Devolutiva humana");
    const semTexto = conteudoAnamneseDaAnalise({ ia_preliminar: "SEGREDO" });
    assert.doesNotMatch(semTexto, /SEGREDO/);
    assert.match(semTexto, /só para a equipe/);
  });

  it("resposta do envio e da lista não incluem ia_preliminar", () => {
    const body = publicSubmitAnaliseBody({
      id: "1",
      ia_preliminar: "SEGREDO",
      imagens: ["x"],
      status: "aguardando_validacao",
      message: "ok",
    });
    assert.equal("ia_preliminar" in body, false);
    assert.equal("imagens" in body, false);
    const row = sanitizePortalAnaliseRow({
      id: "2",
      status: "pending_validation",
      ia_preliminar: "SEGREDO",
      texto_validado: "nao",
    });
    assert.equal("ia_preliminar" in row, false);
    assert.equal(row.texto_validado, null);
  });

  it("código da clínica não joga ia_preliminar no skincare nem na anamnese", () => {
    const skin = readFileSync(join(ROOT, "js/views/skincare.views.js"), "utf8");
    const svc = readFileSync(join(ROOT, "js/services/analise-pele.service.js"), "utf8");
    const route = readFileSync(join(ROOT, "routes/analise-pele.js"), "utf8");
    const portal = readFileSync(join(ROOT, "js/Client/analise-pele.client.js"), "utf8");
    assert.match(skin, /analisesPeleParaSkincare/);
    assert.doesNotMatch(skin, /ia_preliminar/);
    assert.match(svc, /conteudoAnamneseDaAnalise/);
    assert.doesNotMatch(svc, /ia_preliminar, analise\.texto_validado/);
    assert.match(route, /length < 2/);
    assert.match(route, /publicSubmitAnaliseBody/);
    assert.match(portal, /menorAutoriza/);
    assert.match(portal, /responsável legal precisa autorizar/);
  });
});
