/**
 * Lote 42 — canal PF/profissional, margem no orçamento, parcelas sem perder lucro alvo.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeCanalVenda } from "../js/utils/canal-venda.js";
import {
  resumoMargemOrcamento,
  maxParcelasPreservandoLucro,
  textoParcelasSemJuros,
  custoUnitarioServico,
} from "../js/utils/orcamento-margem.js";
import { formatOrcamentoMensagem } from "../js/utils/orcamento.js";
import { pacotesDoAceite } from "../js/utils/ciclo-ouro.js";

function calcularLiquido(valorBruto, taxaPct) {
  if (valorBruto == null || valorBruto <= 0) return 0;
  const pct = Number(taxaPct) || 0;
  return valorBruto * (1 - pct / 100);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("canal de venda, imagem e orçamento com margem", () => {
  it("revenda para profissional é opção, não o padrão", () => {
    const n = normalizeCanalVenda({});
    assert.equal(n.vende_para_cliente, true);
    assert.equal(n.vende_para_profissional, false);
    assert.equal(normalizeCanalVenda({ vende_para_profissional: true }).vende_para_profissional, true);
  });

  it("orçamento separa margem de produto e de serviço e não muda preço", () => {
    const r = resumoMargemOrcamento([
      { kind: "servico", name: "Laser", qty: 1, unit_price: 400, unit_cost: 120 },
      { kind: "produto", name: "Sérum", qty: 2, unit_price: 180, unit_cost: 100 },
    ]);
    assert.equal(r.receitaServico, 400);
    assert.equal(r.receitaProduto, 360);
    assert.equal(r.lucroServico, 280);
    assert.equal(r.lucroProduto, 160);
    assert.equal(r.margemServicoPct, 70);
    const svc = readFileSync(join(ROOT, "js/services/orcamentos.service.js"), "utf8");
    assert.doesNotMatch(svc, /valor_cobrado\s*=/);
  });

  it("parcela só até o lucro alvo depois da taxa", () => {
    const taxaPorN = { 1: 2, 6: 10, 12: 20 };
    const out = maxParcelasPreservandoLucro({
      valor: 1000,
      custo: 200,
      margemAlvoPct: 70,
      getLiquido: (n) => calcularLiquido(1000, taxaPorN[n] ?? 15),
    });
    assert.equal(out.lucroAlvo, 700);
    assert.equal(out.maxParcelas, 6);
    assert.equal(out.parcelaCliente, 166.67);
    const txt = textoParcelasSemJuros(out, { brl: (n) => `R$ ${Number(n).toFixed(2)}` });
    assert.match(txt, /sem juros/i);
    assert.match(txt, /6x/);
    assert.match(txt, /Só a equipe vê/);
  });

  it("custo do serviço prefere a receita de insumos", () => {
    const est = custoUnitarioServico({ valor_cobrado: 450, custo_material_estimado: 18, comissao_profissional_pct: 0 });
    const real = custoUnitarioServico(
      { valor_cobrado: 450, custo_material_estimado: 18, comissao_profissional_pct: 0 },
      { custoMaterialReal: 9.86 }
    );
    assert.equal(est, 18);
    assert.equal(real, 9.86);
  });

  it("WhatsApp do cliente não leva margem nem parcela interna", () => {
    const msg = formatOrcamentoMensagem({
      nomeCliente: "Ana",
      items: [{ name: "HIFU facial", qty: 1, unit_price: 450, unit_cost: 18 }],
    });
    assert.match(msg, /HIFU facial/);
    assert.doesNotMatch(msg, /margem/i);
    assert.doesNotMatch(msg, /maquininha/i);
    assert.doesNotMatch(msg, /insumo/i);
  });

  it("aceite de produto não vira pacote de sessões", () => {
    const pkgs = pacotesDoAceite(
      [
        { kind: "produto", name: "Sérum", qty: 2, unit_price: 180, product_id: "x" },
        { kind: "servico", name: "Laser", qty: 4, unit_price: 250, sessions: 4, procedure_id: "p1" },
      ],
      "c1",
      "o1"
    );
    assert.equal(pkgs.length, 1);
    assert.equal(pkgs[0].nome_pacote, "Laser");
  });

  it("portfólio pede foto e estoque não repete todas as colunas de preço na revenda", () => {
    const view = readFileSync(join(ROOT, "js/views/estoque.views.js"), "utf8");
    assert.match(view, /Foto do produto/);
    assert.match(view, /uploadProdutoImagem/);
    assert.doesNotMatch(view, /Preço profissional[\s\S]*Preço cliente[\s\S]*Lucro un/);
    const dash = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(dash, /precificacaoVendeProfissional/);
    const perfil = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(perfil, /orcamentoAddLinha/);
    assert.match(perfil, /maxParcelasPreservandoLucro/);
    assert.match(perfil, /textoParcelasSemJuros/);
    assert.match(perfil, /Sem juros p\/ o cliente/);
  });
});
