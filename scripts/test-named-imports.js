/**
 * Falha se um import nomeado local não existir no arquivo de origem.
 * Também confere rotas do SPA e scripts dos HTML.
 * Rode: npm run test:imports
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function exportedNames(src) {
  const names = new Set();
  const body = stripComments(src);
  const patterns = [
    /\bexport\s+async\s+function\s+(\w+)/g,
    /\bexport\s+function\s+(\w+)/g,
    /\bexport\s+class\s+(\w+)/g,
    /\bexport\s+const\s+(\w+)/g,
    /\bexport\s+let\s+(\w+)/g,
    /\bexport\s+var\s+(\w+)/g,
    /\bexport\s+\{([^}]+)\}/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(body))) {
      if (re.source.includes("\\{")) {
        for (const part of m[1].split(",")) {
          const bits = part.trim();
          if (!bits || bits === "default") continue;
          const asMatch = bits.match(/\bas\s+(\w+)\s*$/);
          const name = asMatch ? asMatch[1] : bits.replace(/\s+from\s+.*$/, "").split(/\s+/)[0];
          if (name) names.add(name);
        }
      } else {
        names.add(m[1]);
      }
    }
  }
  return names;
}

function namedImports(src) {
  const body = stripComments(src);
  const out = [];
  const re = /\bimport\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(body))) {
    const spec = m[2];
    if (!spec.startsWith(".")) continue;
    const names = m[1]
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const asMatch = p.match(/\bas\s+(\w+)\s*$/);
        if (asMatch) {
          const orig = p.split(/\s+as\s+/)[0].trim();
          return orig;
        }
        return p;
      });
    out.push({ spec, names });
  }
  return out;
}

function resolveSpec(fromFile, spec) {
  let target = path.resolve(path.dirname(fromFile), spec);
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
  if (!path.extname(target)) {
    for (const ext of [".js", ".mjs"]) {
      if (fs.existsSync(target + ext)) return target + ext;
    }
    if (fs.existsSync(path.join(target, "index.js"))) return path.join(target, "index.js");
  }
  return null;
}

describe("imports nomeados locais existem", () => {
  const files = walk(ROOT).filter((f) => f.endsWith(".js") && !f.includes(`${path.sep}scripts${path.sep}test-`));
  const missing = [];

  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    for (const { spec, names } of namedImports(src)) {
      const target = resolveSpec(file, spec);
      const relFrom = path.relative(ROOT, file);
      if (!target) {
        missing.push(`${relFrom} importa ${spec} (arquivo ausente)`);
        continue;
      }
      const exported = exportedNames(fs.readFileSync(target, "utf8"));
      for (const name of names) {
        if (!exported.has(name)) {
          missing.push(`${relFrom} importa { ${name} } de ${spec}`);
        }
      }
    }
  }

  it("nenhum import quebrado", () => {
    assert.deepEqual(missing, []);
  });
});

describe("páginas HTML e rotas SPA", () => {
  it("scripts type=module apontam para arquivos existentes", () => {
    const htmlFiles = walk(ROOT).filter((f) => f.endsWith(".html"));
    const missing = [];
    for (const html of htmlFiles) {
      const src = fs.readFileSync(html, "utf8");
      const re = /<script[^>]+src=["']([^"']+)["']/gi;
      let m;
      while ((m = re.exec(src))) {
        const spec = m[1].split("?")[0];
        if (spec.startsWith("http") || spec.startsWith("//")) continue;
        const target = path.resolve(path.dirname(html), spec);
        if (!fs.existsSync(target)) {
          missing.push(`${path.relative(ROOT, html)} → ${spec}`);
        }
      }
    }
    assert.deepEqual(missing, []);
  });

  it("auth.js exporta os fluxos de login, cadastro e senha", () => {
    const src = fs.readFileSync(path.join(ROOT, "js", "core", "auth.js"), "utf8");
    const names = exportedNames(src);
    for (const n of [
      "updatePassword",
      "sendReset",
      "registerEmail",
      "loginEmail",
      "loginGoogle",
      "authErrorMessage",
    ]) {
      assert.ok(names.has(n), `js/core/auth.js sem export ${n}`);
    }
  });

  it("views do SPA em js/core/spa.js existem", () => {
    const spa = fs.readFileSync(path.join(ROOT, "js", "core", "spa.js"), "utf8");
    const views = [...spa.matchAll(/view:\s*"([^"]+\.js)"/g)].map((m) => m[1]);
    const missing = [];
    for (const view of views) {
      const p = path.join(ROOT, "js", "views", view);
      if (!fs.existsSync(p)) missing.push(view);
    }
    assert.deepEqual(missing, []);
  });
});
