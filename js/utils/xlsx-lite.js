/**
 * Lê a primeira aba de um .xlsx (Office Open XML).
 * Sem biblioteca: ZIP + XML. Humano ainda mapeia colunas na prévia.
 */

const PK_LOCAL = 0x04034b50;
const PK_CENTRAL = 0x02014b50;
const PK_EOCD = 0x05054b50;

function u16(buf, i) {
  return buf[i] | (buf[i + 1] << 8);
}

function u32(buf, i) {
  return (buf[i] | (buf[i + 1] << 8) | (buf[i + 2] << 16) | (buf[i + 3] << 24)) >>> 0;
}

function decodeUtf8(bytes) {
  return new TextDecoder("utf-8").decode(bytes);
}

async function inflateRaw(data) {
  if (typeof process !== "undefined" && process.versions?.node) {
    const { inflateRawSync } = await import("node:zlib");
    return new Uint8Array(inflateRawSync(data));
  }
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Este navegador não lê .xlsx. Salve a planilha como CSV.");
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function normPath(p) {
  return String(p || "").replace(/\\/g, "/").replace(/^\//, "");
}

async function unzip(arrayBuffer) {
  const buf = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
  const files = Object.create(null);
  let i = 0;
  while (i + 30 <= buf.length) {
    const sig = u32(buf, i);
    if (sig === PK_CENTRAL || sig === PK_EOCD) break;
    if (sig !== PK_LOCAL) {
      i += 1;
      continue;
    }
    const flags = u16(buf, i + 6);
    const method = u16(buf, i + 8);
    const compSize = u32(buf, i + 18);
    const nameLen = u16(buf, i + 26);
    const extraLen = u16(buf, i + 28);
    const nameStart = i + 30;
    const name = decodeUtf8(buf.subarray(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    if (flags & 0x8) {
      throw new Error("Este .xlsx veio em formato que não lemos. Salve como CSV ou copie as células.");
    }
    const packed = buf.subarray(dataStart, dataStart + compSize);
    let raw;
    if (method === 0) raw = packed;
    else if (method === 8) raw = await inflateRaw(packed);
    else throw new Error("Compactação do Excel não suportada. Salve como CSV.");
    files[normPath(name)] = decodeUtf8(raw);
    i = dataStart + compSize;
  }
  return files;
}

function xmlText(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

function attr(chunk, name) {
  const m = String(chunk || "").match(new RegExp("\\b" + name + "=\"([^\"]*)\""));
  return m ? m[1] : "";
}

function colIndex(ref) {
  const m = String(ref || "").match(/^([A-Za-z]+)/);
  if (!m) return 0;
  let n = 0;
  for (const ch of m[1].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return Math.max(0, n - 1);
}

function parseSharedStrings(xml) {
  const out = [];
  const siRe = /<si\b[^>]*>[\s\S]*?<\/si>/gi;
  let m;
  while ((m = siRe.exec(xml || ""))) {
    const texts = [...m[0].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((x) => xmlText(x[1]));
    out.push(texts.join(""));
  }
  return out;
}

function cellValue(attrs, inner, sst) {
  const t = attr(attrs, "t");
  if (t === "s") {
    const v = (inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i) || [])[1];
    return sst[Number(v)] ?? "";
  }
  if (t === "inlineStr" || t === "str") {
    const texts = [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((x) => xmlText(x[1]));
    if (texts.length) return texts.join("");
  }
  if (t === "b") {
    const v = (inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i) || [])[1];
    return v === "1" ? "TRUE" : "FALSE";
  }
  const v = (inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i) || [])[1];
  return v != null ? xmlText(v) : "";
}

function parseSheetRows(xml, sst) {
  const rows = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rm;
  while ((rm = rowRe.exec(xml || ""))) {
    const cells = [];
    const cRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let cm;
    while ((cm = cRe.exec(rm[1]))) {
      cells[colIndex(attr(cm[1], "r"))] = cellValue(cm[1], cm[2], sst);
    }
    const last = cells.length - 1;
    if (last < 0 || cells.every((x) => x == null || String(x).trim() === "")) continue;
    for (let i = 0; i <= last; i++) if (cells[i] == null) cells[i] = "";
    rows.push(cells);
  }
  return rows;
}

function firstSheetPath(files) {
  const wb = files["xl/workbook.xml"] || "";
  const rels = files["xl/_rels/workbook.xml.rels"] || "";
  const sheetTag = (wb.match(/<sheet\b[^>]*\/?>/i) || [])[0] || "";
  const rid = attr(sheetTag, "r:id") || attr(sheetTag, "id");
  const relsList = [...rels.matchAll(/<Relationship\b[^>]*\/?>/gi)].map((m) => m[0]);
  const rel = relsList.find((t) => attr(t, "Id") === rid) || relsList.find((t) => /worksheet/i.test(attr(t, "Type")));
  let target = rel ? attr(rel, "Target") : "worksheets/sheet1.xml";
  target = target.replace(/^\.\//, "");
  if (!target.toLowerCase().includes("xl/")) target = "xl/" + target.replace(/^\/+/, "");
  const key = normPath(target);
  if (files[key]) return key;
  const hit = Object.keys(files).find((k) => /xl\/worksheets\/sheet1\.xml$/i.test(k));
  return hit || key;
}

function matrizParaPlanilha(matriz) {
  if (!matriz.length) return { headers: [], rows: [], sheetName: "" };
  const headers = matriz[0].map((h, i) => {
    const s = String(h ?? "").trim();
    return s || "coluna_" + (i + 1);
  });
  const rows = [];
  for (let r = 1; r < matriz.length; r++) {
    const line = matriz[r];
    const obj = {};
    let vazio = true;
    headers.forEach((h, i) => {
      const v = line[i] == null ? "" : String(line[i]);
      obj[h] = v;
      if (v.trim()) vazio = false;
    });
    if (!vazio) rows.push(obj);
  }
  return { headers, rows };
}

export function pareceXlsx(file) {
  const nome = String(file?.name || "").toLowerCase();
  const tipo = String(file?.type || "").toLowerCase();
  if (nome.endsWith(".xlsx")) return true;
  if (tipo.includes("spreadsheetml") || tipo.includes("excel")) return true;
  return false;
}

export function pareceXlsAntigo(file) {
  return String(file?.name || "").toLowerCase().endsWith(".xls") && !pareceXlsx(file);
}

/**
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {Promise<{ headers: string[], rows: object[], sheetName: string }>}
 */
export async function planilhaDeXlsx(buffer) {
  const files = await unzip(buffer);
  if (!files["xl/workbook.xml"] && !Object.keys(files).some((k) => k.startsWith("xl/"))) {
    throw new Error("Arquivo não parece um Excel .xlsx. Tente CSV ou colar as células.");
  }
  const sst = parseSharedStrings(files["xl/sharedStrings.xml"] || "");
  const sheetPath = firstSheetPath(files);
  const sheetXml = files[sheetPath];
  if (!sheetXml) throw new Error("Não achei a primeira aba do Excel. Salve como CSV.");
  const wb = files["xl/workbook.xml"] || "";
  const sheetTag = (wb.match(/<sheet\b[^>]*\/?>/i) || [])[0] || "";
  const sheetName = xmlText(attr(sheetTag, "name")) || "Planilha1";
  const parsed = matrizParaPlanilha(parseSheetRows(sheetXml, sst));
  parsed.sheetName = sheetName;
  if (!parsed.rows.length) {
    throw new Error("A primeira aba do Excel está vazia. Nada foi gravado.");
  }
  return parsed;
}
