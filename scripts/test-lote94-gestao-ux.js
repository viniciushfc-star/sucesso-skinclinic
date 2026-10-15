/**
 * Lote 94 — Gestão usável: estoque e equipe em abas, convite humano, SQL fora da rotina.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bindGestaoAbas } from "../js/utils/gestao-abas.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function src(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Lote 94 UX da Gestão", () => {
  it("estoque tem abas e SQL só no details", () => {
    const html = src("dashboard.html");
    const trecho = html.slice(html.indexOf('id="view-estoque"'), html.indexOf('id="view-ocr"'));
    assert.match(trecho, /data-gestao-tab="saldo"/);
    assert.match(trecho, /data-gestao-tab="portfolio"/);
    assert.match(trecho, /data-gestao-tab="entrada"/);
    assert.match(trecho, /id="btnEstoqueIrEntrada"/);
    assert.match(trecho, /<details id="estoquePortfolioSqlHint"/);
    assert.doesNotMatch(trecho, /<p id="estoquePortfolioSqlHint"/);
    assert.match(src("js/views/estoque.views.js"), /bindGestaoAbas/);
    assert.match(src("js/core/spa.js"), /carta-ilustra-1/);
    assert.match(src("js/css/style.css"), /gestao-abas-tab/);
    assert.match(src("js/css/style.css"), /width:auto/);
  });

  it("equipe cadastra profissional; SQL e env não estão no lead", () => {
    const html = src("dashboard.html");
    const trecho = html.slice(html.indexOf('id="view-team"'), html.indexOf('id="view-clientes"'));
    assert.match(trecho, /Cadastrar profissional/);
    assert.match(trecho, /data-gestao-tab="pessoas"/);
    assert.doesNotMatch(trecho, /Convidar usuário/);
    const lead = trecho.slice(0, trecho.indexOf("team-google-config-details"));
    assert.doesNotMatch(lead, /supabase-equipe-agenda-membros-colar/);
    assert.doesNotMatch(lead, /GOOGLE_CLIENT_ID/);
    const team = src("js/views/team.views.js");
    assert.match(team, /Cadastrar profissional/);
    assert.doesNotMatch(team, /RESEND_API_KEY/);
    assert.match(team, /modalFields/);
    assert.match(team, /Enviar convite/);
  });

  it("radar e taxas saem do ninho do financeiro; auditoria mantém Gestão aberta", () => {
    const html = src("dashboard.html");
    const finStart = html.indexOf('id="financeiroSubmenu"');
    const finUlEnd = html.indexOf("</ul>", finStart);
    const nested = html.slice(finStart, finUlEnd);
    const gestao = html.slice(html.indexOf('id="gestaoSubmenu"'), html.indexOf('id="inteligenciaWrap"'));
    assert.doesNotMatch(nested, /data-view="market-radar"/);
    assert.doesNotMatch(nested, /data-view="precificacao-taxas"/);
    assert.match(gestao, /data-view="market-radar"/);
    assert.match(gestao, /data-view="precificacao-taxas"/);
    assert.match(src("js/core/spa.js"), /"auditoria"/);
  });

  it("bindGestaoAbas existe e não quebra sem root", () => {
    assert.equal(typeof bindGestaoAbas, "function");
    const noop = bindGestaoAbas(null, "x", "saldo");
    noop("entrada");
  });
});
