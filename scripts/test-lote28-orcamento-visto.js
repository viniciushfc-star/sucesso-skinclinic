/**
 * Lote 28 — orçamento visualizado e convertido (só na tela).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  statusEfetivoOrcamento,
  payloadOrcamentoVisto,
  idsOrcamentosVistos,
  contarPacotesPorOrcamento,
  PREFIXO_ORCAMENTO_VISTO,
} from "../js/utils/orcamento.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("orçamento visto e convertido", () => {
  it("não grava convertido no CHECK; visto vem do evento", () => {
    const enviado = { status: "enviado", valid_until: "2026-12-01" };
    assert.equal(statusEfetivoOrcamento(enviado, "2026-09-26"), "enviado");
    assert.equal(statusEfetivoOrcamento(enviado, "2026-09-26", { visto: true }), "visualizado");
    assert.equal(statusEfetivoOrcamento({ status: "aceito" }, "2026-09-26"), "aceito");
    assert.equal(statusEfetivoOrcamento({ status: "aceito" }, "2026-09-26", { packagesCount: 2 }), "convertido");
    const p = payloadOrcamentoVisto("abc");
    assert.equal(p.description, `${PREFIXO_ORCAMENTO_VISTO}abc`);
    const ids = idsOrcamentosVistos([{ event_type: "orcamento_visto", description: p.description }]);
    assert.equal(ids.has("abc"), true);
    assert.equal(contarPacotesPorOrcamento([{ orcamento_id: "o1" }, { orcamento_id: "o1" }]).o1, 2);
  });

  it("perfil marca visto sem status visualizado no SQL", () => {
    const view = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    const sql = readFileSync(join(ROOT, "supabase/supabase-orcamentos-colar.sql"), "utf8");
    assert.match(view, /orcamento-visto/);
    assert.match(view, /payloadOrcamentoVisto/);
    assert.match(sql, /rascunho.*enviado.*aceito.*recusado/);
    assert.doesNotMatch(sql, /visualizado/);
  });
});
