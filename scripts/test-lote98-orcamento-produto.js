/**
 * Lote 98 — orçamento só de produto e proposta apresentável para a cliente.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  soProdutoOrcamento,
  htmlPropostaOrcamento,
  formatOrcamentoMensagem,
} from "../js/utils/orcamento.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 98 orçamento de produto e proposta", () => {
  it("reconhece proposta só de produto e não leva custo na folha", () => {
    const items = [
      { kind: "produto", name: "Sérum", qty: 2, unit_price: 180, unit_cost: 90 },
    ];
    assert.equal(soProdutoOrcamento(items), true);
    assert.equal(soProdutoOrcamento([{ kind: "servico", name: "Laser", qty: 1, unit_price: 400 }]), false);
    const html = htmlPropostaOrcamento({
      nomeClinica: "Clínica X",
      nomeCliente: "Ana",
      items,
      validUntil: "2026-10-29",
    });
    assert.match(html, /Proposta para/);
    assert.match(html, /Ana/);
    assert.match(html, /Sérum/);
    assert.match(html, /R\$ 360,00/);
    assert.doesNotMatch(html, /margem/i);
    assert.doesNotMatch(html, /maquininha/i);
    assert.doesNotMatch(html, /unit_cost/);
    const msg = formatOrcamentoMensagem({ nomeCliente: "Ana", items });
    assert.match(msg, /Produtos/);
    assert.doesNotMatch(msg, /90/);
  });

  it("ficha adiciona produto sem esconder o cadastro e abre proposta", () => {
    const view = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(view, /Adicionar produto/);
    assert.match(view, /orcamentoAddServico/);
    assert.match(view, /htmlPropostaOrcamento/);
    assert.match(view, /orcamento-proposta/);
    assert.match(view, /Produto não vira sessão/);
    const spa = readFileSync(join(ROOT, "js/core/spa.js"), "utf8");
    assert.match(spa, /carta-ilustra-1/);
    const svc = readFileSync(join(ROOT, "js/services/orcamentos.service.js"), "utf8");
    assert.match(svc, /created: true/);
  });
});
