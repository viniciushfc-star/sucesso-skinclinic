/**
 * Leftover: Dar baixa e editar procedimento não morrem em coluna extra;
 * getProcedure precisa trazer custo para a fórmula da margem.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { retryUnknownColumns } from "../js/utils/supabase-unknown-col.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function src(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("baixa, procedimento e orçamento", () => {
  it("retryUnknownColumns acumula o strip da coluna citada", async () => {
    let n = 0;
    const { data, error } = await retryUnknownColumns(
      { valor: 10, agenda_id: "a", forma_pagamento: "pix" },
      async (row) => {
        n += 1;
        if ("agenda_id" in row) {
          return { data: null, error: { message: "Could not find the 'agenda_id' column of 'financeiro' in the schema cache" } };
        }
        if ("forma_pagamento" in row) {
          return { data: null, error: { message: 'column "forma_pagamento" of relation "financeiro" does not exist' } };
        }
        return { data: { id: "ok", ...row }, error: null };
      },
      { immutable: ["valor"] }
    );
    assert.equal(error, null);
    assert.equal(data.id, "ok");
    assert.equal(data.valor, 10);
    assert.equal(data.agenda_id, undefined);
    assert.equal(n, 3);
  });

  it("Dar baixa grava via createLancamento e getProcedure pede custo/margem", () => {
    const agenda = src("js/views/agenda.views.js");
    assert.match(agenda, /createLancamento/);
    assert.doesNotMatch(agenda, /from\("financeiro"\)\s*\.insert/);
    const proc = src("js/services/procedimentos.service.js");
    assert.match(proc, /custo_material_estimado, margem_minima_desejada, comissao_profissional_pct/);
    assert.match(proc, /retryUnknownColumns/);
    const fin = src("js/services/financeiro.service.js");
    assert.match(fin, /export async function createLancamento/);
  });

  it("orçamento e SQL leftover de baixa existem", () => {
    assert.match(src("js/services/orcamentos.service.js"), /retryUnknownColumns/);
    const sql = src("supabase/supabase-fase0-baixa-procedimento-colar.sql");
    assert.match(sql, /agenda_id/);
    assert.match(sql, /custo_material_estimado/);
    assert.doesNotMatch(sql, /service_role/);
  });
});
