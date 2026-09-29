import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseClientesBusca,
  nextRelacaoComercial,
  relacaoComercialLabel,
} from "../js/utils/cliente-relacao.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("relação comercial e busca de orçamento", () => {
  it("busca orçamento abre atalho e deixa o nome do cliente", () => {
    const so = parseClientesBusca("orçamento");
    assert.equal(so.abrirOrcamento, true);
    assert.equal(so.texto, "");
    const comNome = parseClientesBusca("orçamento Ana");
    assert.equal(comNome.abrirOrcamento, true);
    assert.equal(comNome.texto.toLowerCase(), "ana");
    const rev = parseClientesBusca("revenda");
    assert.equal(rev.relacao, "revenda");
    assert.equal(rev.abrirOrcamento, false);
  });

  it("aceite vira comprou e não sobrescreve revenda", () => {
    assert.equal(nextRelacaoComercial("", "orcamento_criado"), "orcamento");
    assert.equal(nextRelacaoComercial("orcamento", "orcamento_aceito"), "comprou");
    assert.equal(nextRelacaoComercial("revenda", "orcamento_aceito"), "revenda");
    assert.equal(relacaoComercialLabel("revenda"), "Revenda da clínica");
  });

  it("lista de clientes busca e perfil abrem o orçamento", () => {
    const view = readFileSync(join(ROOT, "js/views/clientes.views.js"), "utf8");
    assert.match(view, /listOrcamentosForSearch/);
    assert.match(view, /clientePerfilOpenTab/);
    assert.match(view, /relacao_comercial/);
    const perfil = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(perfil, /clientePerfilOrcamentoId/);
    assert.match(perfil, /editRelacaoComercial/);
    const dash = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(dash, /clientesFilterRelacao/);
    assert.match(dash, /clientesBuscaOrcamentos/);
  });
});
