/**
 * Lote 69 — ciclo ouro visível na abertura do perfil 360.
 * Sem rota Atendimentos. Ações de gravar continuam na aba Protocolo.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { linhaCicloOuroCabecalho, resumoCicloOuroFicha } from "../js/utils/ciclo-ouro-ficha.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 69 ciclo no perfil 360", () => {
  it("cabeçalho resume combinado, receita e feito", () => {
    const r = resumoCicloOuroFicha({
      planosCliente: [{ nome: "Oleosidade" }, { nome: "Pós peeling" }],
      protocolos: [{ id: "p1", nome: "Limpeza profunda" }],
      aplicados: [{ protocolo_id: "p1", protocolos: { nome: "Limpeza profunda" } }],
    });
    const linha = linhaCicloOuroCabecalho(r);
    assert.equal(linha.combinado, "Oleosidade (+1)");
    assert.equal(linha.receita, "Limpeza profunda");
    assert.equal(linha.feito, "Limpeza profunda");
    const vazio = linhaCicloOuroCabecalho(resumoCicloOuroFicha({}));
    assert.equal(vazio.combinado, "—");
    assert.equal(vazio.feito, "—");
  });

  it("Dados mostra as três colunas; Protocolo guarda os botões; sem Atendimentos", () => {
    const view = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(view, /renderCicloOuroFichaDados/);
    assert.match(view, /cliente-perfil-ciclo-linha/);
    assert.match(view, /btnCicloVerProtocolo/);
    assert.match(view, /id="tabDados"[\s\S]*renderCicloOuroFichaDados/);
    assert.match(view, /id="tabProtocolo"[\s\S]*renderCicloOuroFicha\(/);
    assert.match(view, /btnCicloRegistrarAplicado/);
    assert.match(view, /pane\.classList\.add\("active"\)/);
    assert.doesNotMatch(view, /view-atendimentos|#atendimentos/);
    const css = readFileSync(join(ROOT, "js/css/style.css"), "utf8");
    assert.match(css, /ciclo-ouro-ficha-wrap--dados/);
    const dash = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(dash, /style\.css\?v=/);
  });
});
