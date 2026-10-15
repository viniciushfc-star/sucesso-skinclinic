/**
 * Lote 95 — UX da clínica inteira: botão não herda o login, SQL fora da rotina, Configurações fecha.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function src(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Lote 95 UX de todos os módulos", () => {
  it("no app o botão cabe no texto; no login continua largo", () => {
    const css = src("js/css/style.css");
    assert.match(css, /body:has\(\.app-wrapper\) button\{[\s\S]*?width:auto/);
    assert.match(css, /body:not\(:has\(\.app-wrapper\)\):not\(\.portal-app\) button\{[\s\S]*?width:100%/);
    assert.match(css, /\.sidebar button\.sidebar-item\{[\s\S]*?width:100%/);
  });

  it("Configurações fecha antes de Pagamento; Relacionamento sem crm2 na cara", () => {
    const html = src("dashboard.html");
    const master = html.slice(html.indexOf('id="view-master"'), html.indexOf('id="view-pagamento"'));
    assert.match(master, /<\/section>/);
    assert.match(html, /id="view-pagamento"/);
    const crm = html.slice(html.indexOf('id="view-crm"'), html.indexOf('id="view-calendario-conteudo"'));
    assert.match(crm, /<h2>Relacionamento<\/h2>/);
    assert.doesNotMatch(crm, /crm2/);
    assert.match(crm, /<details class="view-sql-details">/);
    assert.match(crm, /supabase-fase0-waitlist-colar/);
  });

  it("Protocolo, Skincare e Empresa falam com a clínica", () => {
    const html = src("dashboard.html");
    const proto = html.slice(html.indexOf('id="view-protocolo"'), html.indexOf('id="view-anamnese"'));
    assert.match(proto, /<h2 class="protocolo-ia-title">Protocolo<\/h2>/);
    assert.doesNotMatch(proto, /view Pele|view Análise/);
    const skin = html.slice(html.indexOf('id="view-skincare"'), html.indexOf('id="view-estudo-caso"'));
    assert.match(skin, /<h2>Skincare<\/h2>/);
    assert.doesNotMatch(skin, /Skincare IA/);
    const emp = html.slice(html.indexOf('id="view-empresa"'), html.indexOf('id="view-team"'));
    assert.match(emp, /view-sql-details/);
    assert.match(src("js/core/spa.js"), /mapa-clinico-1/);
  });
});
