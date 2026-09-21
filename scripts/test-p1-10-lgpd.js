/**
 * P1-10 — LGPD titular (sem HTTP).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isLgpdClientId,
  stripRestrictedExportFields,
  buildErasedClientPatch,
} from "../js/utils/lgpd-titular.js";

describe("P1-10 LGPD titular", () => {
  it("só aceita UUID canônico", () => {
    assert.equal(isLgpdClientId("3"), false);
    assert.equal(isLgpdClientId("00000000-0000-4000-8000-000000000099"), true);
  });

  it("export de analise_pele remove ia_preliminar", () => {
    const out = stripRestrictedExportFields("analise_pele", [
      { id: "1", ia_preliminar: "SEGREDO", imagens: [] },
    ]);
    assert.equal(out[0].ia_preliminar, undefined);
    assert.deepEqual(out[0].imagens, []);
  });

  it("patch de exclusão não conserva e-mail nem telefone reais", () => {
    const id = "00000000-0000-4000-8000-000000000099";
    const patch = buildErasedClientPatch(id);
    assert.equal(patch.name, "Titular excluído");
    assert.equal(patch.phone, null);
    assert.equal(patch.cpf, null);
    assert.match(patch.email, /@lgpd\.invalid$/);
    assert.equal(patch.state, "arquivado");
    assert.equal(patch.notes, null);
  });
});
