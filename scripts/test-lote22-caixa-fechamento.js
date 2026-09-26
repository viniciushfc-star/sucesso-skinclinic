/**
 * Lote 22 — fechamento de caixa e valores em aberto.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resumirFechamento,
  conferirCaixa,
  listarInadimplencia,
  chaveForma,
  payloadAuditoriaFechamento,
} from "../js/utils/caixa-fechamento.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("fechamento de caixa", () => {
  it("soma o dia, aponta aberto e não inventa conferência", () => {
    const rows = [
      { tipo: "entrada", data: "2026-09-26", valor: 200, valor_recebido: 150, forma_pagamento: "dinheiro", descricao: "A" },
      { tipo: "entrada", data: "2026-09-26", valor: 80, forma_pagamento: "pix", descricao: "B" },
      { tipo: "saida", data: "2026-09-26", valor: 30, descricao: "C" },
      { tipo: "entrada", data: "2026-09-25", valor: 999, valor_recebido: 1, descricao: "ontem" },
    ];
    const r = resumirFechamento(rows, "2026-09-26");
    assert.equal(r.entradas, 230);
    assert.equal(r.saidas, 30);
    assert.equal(r.saldo, 200);
    assert.equal(r.esperadoDinheiro, 150);
    assert.equal(chaveForma("PIX"), "pix");
    const conf = conferirCaixa({ esperado: 150, conferido: 140 });
    assert.equal(conf.ok, false);
    assert.equal(conf.diferenca, -10);
    assert.equal(conferirCaixa({ esperado: 150, conferido: "" }).ok, null);
    const aberto = listarInadimplencia(rows);
    assert.equal(aberto.length, 2);
    const meta = payloadAuditoriaFechamento(r, conf);
    assert.equal(meta.diferencaDinheiro, -10);
  });

  it("aba existe e registrar não insere financeiro", () => {
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    const view = readFileSync(join(ROOT, "js/views/financeiro.views.js"), "utf8");
    assert.match(html, /data-tab="fechamento"/);
    const trecho = view.slice(view.indexOf("registrarConferenciaCaixa"), view.indexOf("function bindDreEvents"));
    assert.match(trecho, /financeiro\.fechamento/);
    assert.doesNotMatch(trecho, /\.insert\(/);
  });
});
