/**
 * Lote 75 — traga sua lista: mapa de colunas, colar planilha, prévia antes de gravar.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectarSeparador,
  parsePlanilhaTexto,
  sugerirMapa,
  aplicarMapa,
  faltandoObrigatorios,
  htmlMapaColunas,
  normalizarCabecalho,
} from "../js/utils/import-mapa.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 75 traga sua lista", () => {
  it("cola do Excel (tab) e mapeia Paciente/WhatsApp → nome/telefone", () => {
    const tsv = "Paciente\tWhatsApp\tE-mail\nAna Souza\t11988887777\tana@ex.com";
    assert.equal(detectarSeparador("Paciente\tWhatsApp"), "\t");
    const parsed = parsePlanilhaTexto(tsv);
    assert.deepEqual(parsed.headers, ["Paciente", "WhatsApp", "E-mail"]);
    const mapa = sugerirMapa(parsed.headers, "clientes");
    assert.equal(mapa.nome, "Paciente");
    assert.equal(mapa.telefone, "WhatsApp");
    assert.equal(mapa.email, "E-mail");
    assert.deepEqual(faltandoObrigatorios(mapa, "clientes"), []);
    const rows = aplicarMapa(parsed.rows, mapa);
    assert.equal(rows[0].nome, "Ana Souza");
    assert.equal(rows[0].telefone, "11988887777");
    assert.ok(rows[0].nome && (rows[0].email || rows[0].telefone));
  });

  it("CSV com ponto-e-vírgula: cabeçalho vira chave normalizada", () => {
    const parsed = parsePlanilhaTexto("nome;telefone;email\nJoão;11999990000;joao@ex.com");
    assert.equal(detectarSeparador("nome;telefone"), ";");
    assert.equal(parsed.rows[0].nome, "João");
    assert.equal(normalizarCabecalho("E-mail"), "e_mail");
  });

  it("sem nome mapeado não importa; HTML pede confirmação humana", () => {
    const mapa = sugerirMapa(["foo", "bar"], "clientes");
    assert.ok(faltandoObrigatorios(mapa, "clientes").length >= 1);
    const html = htmlMapaColunas("clientes", ["Cliente", "Cel"], sugerirMapa(["Cliente", "Cel"], "clientes"));
    assert.match(html, /import-mapa/);
    assert.match(html, /data-dest="nome"/);
    assert.match(html, /Cliente/);
  });

  it("Hoje, Pacientes e Export apontam Traga sua lista; nada grava na leitura", () => {
    const dash = readFileSync(join(ROOT, "js/views/dashboard.views.js"), "utf8");
    assert.match(dash, /Traga sua lista/);
    assert.match(dash, /data-view="export"/);
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(html, /id="btnTragaLista"/);
    assert.match(html, /id="importColarTexto"/);
    assert.match(html, /id="btnImportColar"/);
    assert.match(html, /id="btnImportarLote"[^>]*disabled/);
    const exp = readFileSync(join(ROOT, "js/views/export.views.js"), "utf8");
    assert.match(exp, /htmlMapaColunas/);
    assert.match(exp, /nada foi gravado ainda/);
    assert.match(exp, /pendingMappedRows/);
    assert.doesNotMatch(exp, /sendWhatsapp/);
    const cli = readFileSync(join(ROOT, "js/views/clientes.views.js"), "utf8");
    assert.match(cli, /btnTragaLista/);
    assert.match(cli, /irParaImportacaoComPrevia\("clientes"/);
    const ritmo = readFileSync(join(ROOT, "js/utils/import-ritmo.js"), "utf8");
    assert.match(ritmo, /importTipoPrefill/);
    const lote = readFileSync(join(ROOT, "js/services/importacao-lote.service.js"), "utf8");
    assert.match(lote, /opts\.rows/);
    assert.match(lote, /parsePlanilhaTexto/);
  });
});
