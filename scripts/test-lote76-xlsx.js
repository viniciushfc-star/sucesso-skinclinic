/**
 * Lote 76 — Traga sua lista lê a primeira aba de um .xlsx (sem gravar).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { planilhaDeXlsx, pareceXlsx, pareceXlsAntigo } from "../js/utils/xlsx-lite.js";
import { sugerirMapa, aplicarMapa, faltandoObrigatorios } from "../js/utils/import-mapa.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function u16(n) {
  return Uint8Array.of(n & 0xff, (n >> 8) & 0xff);
}
function u32(n) {
  return Uint8Array.of(n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff);
}
function concat(parts) {
  const size = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(size);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function zipEntries(entries, method) {
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of entries) {
    const nameB = enc.encode(name);
    const raw = enc.encode(text);
    const data = method === 8 ? new Uint8Array(deflateRawSync(raw)) : raw;
    const local = concat([
      Uint8Array.of(0x50, 0x4b, 0x03, 0x04),
      u16(20),
      u16(0),
      u16(method),
      u16(0),
      u16(0),
      u32(0),
      u32(data.length),
      u32(raw.length),
      u16(nameB.length),
      u16(0),
      nameB,
      data,
    ]);
    const central = concat([
      Uint8Array.of(0x50, 0x4b, 0x01, 0x02),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(data.length),
      u32(raw.length),
      u16(nameB.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameB,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralBlob = concat(centrals);
  const eocd = concat([
    Uint8Array.of(0x50, 0x4b, 0x05, 0x06),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralBlob.length),
    u32(offset),
    u16(0),
  ]);
  return concat([...locals, centralBlob, eocd]);
}

function zipStore(entries) {
  return zipEntries(entries, 0);
}

function zipDeflate(entries) {
  return zipEntries(entries, 8);
}

function miniParts() {
  const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const relNs = "http://schemas.openxmlformats.org/package/2006/relationships";
  return [
    [
      "xl/workbook.xml",
      `<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Pacientes" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0"?><Relationships xmlns="${relNs}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
    ],
    [
      "xl/sharedStrings.xml",
      `<?xml version="1.0"?><sst xmlns="${ns}" count="6" uniqueCount="6"><si><t>Paciente</t></si><si><t>WhatsApp</t></si><si><t>E-mail</t></si><si><t>Ana Souza</t></si><si><t>11988887777</t></si><si><t>ana@ex.com</t></si></sst>`,
    ],
    [
      "xl/worksheets/sheet1.xml",
      `<?xml version="1.0"?><worksheet xmlns="${ns}"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="C2" t="s"><v>5</v></c></row></sheetData></worksheet>`,
    ],
  ];
}

function miniXlsx() {
  return zipStore(miniParts());
}

describe("Lote 76 Excel .xlsx nativo", () => {
  it("lê a primeira aba e mapeia Paciente → nome sem gravar", async () => {
    const parsed = await planilhaDeXlsx(miniXlsx());
    assert.deepEqual(parsed.headers, ["Paciente", "WhatsApp", "E-mail"]);
    assert.equal(parsed.rows[0].Paciente, "Ana Souza");
    assert.equal(parsed.sheetName, "Pacientes");
    const mapa = sugerirMapa(parsed.headers, "clientes");
    assert.equal(mapa.nome, "Paciente");
    assert.equal(mapa.telefone, "WhatsApp");
    assert.deepEqual(faltandoObrigatorios(mapa, "clientes"), []);
    const rows = aplicarMapa(parsed.rows, mapa);
    assert.equal(rows[0].nome, "Ana Souza");
    assert.equal(rows[0].telefone, "11988887777");
  });

  it("lê .xlsx compactado como o Excel real (deflate)", async () => {
    const parsed = await planilhaDeXlsx(zipDeflate(miniParts()));
    assert.equal(parsed.rows[0].Paciente, "Ana Souza");
    assert.equal(parsed.rows[0]["E-mail"], "ana@ex.com");
  });

  it("reconhece .xlsx e recusa .xls antigo", () => {
    assert.equal(pareceXlsx({ name: "lista.xlsx" }), true);
    assert.equal(pareceXlsAntigo({ name: "lista.xls" }), true);
    assert.equal(pareceXlsAntigo({ name: "lista.xlsx" }), false);
  });

  it("Export e Hoje falam .xlsx; import aceita o tipo; nada grava na leitura", () => {
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(html, /id="importFile"[^>]*\.xlsx/);
    assert.match(html, /envie o <strong>\.xlsx<\/strong>/);
    const exp = readFileSync(join(ROOT, "js/views/export.views.js"), "utf8");
    assert.match(exp, /planilhaDeXlsx/);
    assert.match(exp, /pareceXlsx/);
    assert.match(exp, /nada foi gravado ainda/);
    assert.doesNotMatch(exp, /sendWhatsapp/);
    const dash = readFileSync(join(ROOT, "js/views/dashboard.views.js"), "utf8");
    assert.match(dash, /\.xlsx/);
  });
});
