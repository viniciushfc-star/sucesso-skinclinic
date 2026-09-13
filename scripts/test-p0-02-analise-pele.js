/**
 * Testes P0-02 — helpers de path/privacidade (sem inventar PASS contra o Supabase).
 * Rode: node --test scripts/test-p0-02-analise-pele.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  ANALISE_PELE_BUCKET,
  extractAnalisePeleObjectPath,
  isOwnedAnalisePelePath,
  collectOwnedAnalisePelePaths,
  sanitizePortalAnaliseRow,
} from "../lib/analise-pele-storage.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("P0-02 paths", () => {
  const org = "11111111-1111-1111-1111-111111111111";
  const client = "22222222-2222-2222-2222-222222222222";
  const path = `${org}/${client}/123/foto_0.jpg`;

  it("path puro permanece", () => {
    assert.equal(extractAnalisePeleObjectPath(path), path);
  });

  it("extrai path de URL pública antiga", () => {
    const url = `https://xx.supabase.co/storage/v1/object/public/${ANALISE_PELE_BUCKET}/${path}`;
    assert.equal(extractAnalisePeleObjectPath(url), path);
  });

  it("não aceita path de outro cliente/org", () => {
    assert.equal(isOwnedAnalisePelePath(path, org, client), true);
    assert.equal(isOwnedAnalisePelePath(path, org, "outro"), false);
    assert.equal(isOwnedAnalisePelePath(`${org}/outro/1/foto.jpg`, org, client), false);
    assert.equal(isOwnedAnalisePelePath(`../${path}`, org, client), false);
  });

  it("ignora URL pública de outro bucket", () => {
    const url = "https://xx.supabase.co/storage/v1/object/public/client-photos/x.jpg";
    assert.equal(extractAnalisePeleObjectPath(url), "");
  });

  it("collectOwned filtra invasão", () => {
    const imgs = [path, `${org}/outro/1/x.jpg`, "https://evil.example/a.jpg"];
    assert.deepEqual(collectOwnedAnalisePelePaths(imgs, org, client), [path]);
  });
});

describe("P0-02 portal sanitize", () => {
  it("pendente não leva ia_preliminar nem texto_validado", () => {
    const row = sanitizePortalAnaliseRow({
      id: "a1",
      status: "pending_validation",
      created_at: "2026-01-01",
      texto_validado: "secreto",
      ia_preliminar: "nao pode sair",
      imagens: ["x"],
    });
    assert.equal(row.texto_validado, null);
    assert.equal("ia_preliminar" in row, false);
    assert.equal("imagens" in row, false);
  });

  it("validada leva só texto_validado", () => {
    const row = sanitizePortalAnaliseRow({
      id: "a2",
      status: "validated",
      created_at: "2026-01-01",
      texto_validado: "ok clinico",
      ia_preliminar: "interno",
    });
    assert.equal(row.texto_validado, "ok clinico");
    assert.equal("ia_preliminar" in row, false);
  });
});

describe("P0-02 grep no código", () => {
  it("routes/analise-pele.js não usa getPublicUrl", () => {
    const src = readFileSync(join(root, "routes/analise-pele.js"), "utf8");
    assert.equal(src.includes("getPublicUrl"), false);
    assert.doesNotMatch(src, /return res\.status\(200\)\.json\([\s\S]{0,400}ia_preliminar/);
    assert.match(src, /status: "aguardando_validacao"/);
  });
});
