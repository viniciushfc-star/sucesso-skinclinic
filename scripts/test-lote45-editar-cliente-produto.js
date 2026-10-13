/**
 * Leftover: editar cliente e produto não pode morrer em coluna extra do schema live.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  columnFromPostgrestError,
  stripUnknownColumn,
} from "../js/utils/supabase-unknown-col.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function src(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("editar cliente e produto", () => {
  it("tira só a coluna citada no erro do PostgREST", () => {
    const msg = "Could not find the 'is_paciente_modelo' column of 'clients' in the schema cache";
    assert.equal(columnFromPostgrestError(msg), "is_paciente_modelo");
    const next = stripUnknownColumn(
      { name: "Ana", is_paciente_modelo: true, updated_at: "x" },
      { message: msg },
      { immutable: ["name"] }
    );
    assert.equal(next.is_paciente_modelo, undefined);
    assert.equal(next.name, "Ana");
    assert.equal(next.updated_at, "x");
    const pg = stripUnknownColumn(
      { observacao: "a", nome: "Sérum" },
      { message: 'column "observacao" of relation "estoque_produtos" does not exist' },
      { immutable: ["nome"] }
    );
    assert.equal(pg.observacao, undefined);
    assert.equal(pg.nome, "Sérum");
  });

  it("updateClient não recoloca updated_at depois de tirar coluna desconhecida", () => {
    const svc = src("js/services/clientes.service.js");
    assert.match(svc, /stripUnknownColumn/);
    assert.match(svc, /stripClientAttempt/);
    assert.doesNotMatch(svc, /attempt = \{ \.\.\.next, updated_at:/);
    assert.match(src("js/views/cliente-perfil.views.js"), /id="btnEditarCliente"/);
    assert.match(src("js/views/cliente-perfil.views.js"), /is_paciente_modelo/);
  });

  it("portfólio tira qualquer coluna desconhecida e não só duas", () => {
    const est = src("js/services/estoque-produtos.service.js");
    assert.match(est, /stripUnknownColumn/);
    assert.doesNotMatch(est, /\["quantidade_minima", "imagem_url"\]/);
    assert.match(est, /throwProdutoWrite/);
    assert.match(src("js/views/estoque.views.js"), /estoque-btn-editar-produto/);
    assert.match(src("js/views/estoque.views.js"), /openCadastroProduto\(row\)/);
  });

  it("SQL leftover de colunas e WITH CHECK de update existe", () => {
    const sql = src("supabase/supabase-fase0-editar-cliente-produto-colar.sql");
    assert.match(sql, /is_paciente_modelo/);
    assert.match(sql, /quantidade_minima/);
    assert.match(sql, /WITH CHECK/);
    assert.doesNotMatch(sql, /service_role/);
  });

  it("lista de pacientes mostra Editar sem depender de hover", () => {
    const css = src("js/css/style.css");
    const block = css.slice(css.indexOf(".clientes-row-acoes{"), css.indexOf(".clientes-acao-wa--off"));
    assert.match(block, /pointer-events:auto/);
    assert.doesNotMatch(block, /pointer-events:none/);
  });
});
