/**
 * Lote 13 — portfólio sem quantidade, validade < 1 ano, custo + frete, lucro.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  alertaValidade,
  custoCatalogoComFrete,
  custoUnitarioComFrete,
  montarRevenda,
} from "../js/utils/estoque-revenda.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("portfólio e revenda de estoque", () => {
  it("sinaliza validade com menos de um ano e vencido", () => {
    const hoje = new Date("2026-09-25T12:00:00");
    const perto = alertaValidade("2027-03-01", hoje);
    assert.equal(perto.nivel, "menos_1_ano");
    const longe = alertaValidade("2028-01-01", hoje);
    assert.equal(longe, null);
    const vencido = alertaValidade("2026-01-01", hoje);
    assert.equal(vencido.nivel, "vencido");
  });

  it("frete entra no custo investido e lucro usa preço de cliente", () => {
    assert.equal(custoCatalogoComFrete(80, 20), 100);
    const unit = custoUnitarioComFrete({
      valorUnitario: 50,
      quantidade: 2,
      valorFrete: 10,
    });
    assert.equal(unit, 55);
    const rows = montarRevenda({
      catalogo: [
        {
          nome: "Sérum",
          custo_pago: 80,
          frete_padrao: 20,
          preco_profissional: 120,
          preco_cliente: 180,
        },
      ],
      consumoPorNome: { Sérum: 3 },
    });
    assert.equal(rows[0].saida, 3);
    assert.equal(rows[0].custo_investido, 100);
    assert.equal(rows[0].lucro_cliente_un, 80);
    assert.equal(rows[0].lucro_estimado_saida, 240);
    assert.equal(rows[0].lucro_profissional_un, 20);
  });

  it("cadastro de portfólio não exige quantidade; entrada sim", () => {
    const view = readFileSync(join(ROOT, "js/views/estoque.views.js"), "utf8");
    const svc = readFileSync(join(ROOT, "js/services/estoque-entradas.service.js"), "utf8");
    const sql = readFileSync(join(ROOT, "supabase/supabase-estoque-portfolio-colar.sql"), "utf8");
    assert.match(view, /Cadastrar produto no portfólio/);
    assert.match(view, /Só o nome é obrigatório/);
    assert.match(view, /Entrada no estoque/);
    assert.match(svc, /Cadastre o produto no portfólio/);
    assert.match(sql, /estoque_produtos/);
    assert.match(sql, /valor_frete/);
    assert.doesNotMatch(sql, /quantidade decimal.*estoque_produtos/s);
  });
});
