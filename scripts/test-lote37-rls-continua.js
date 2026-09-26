/**
 * Lote 37 — prova RLS contínua: RPC portal, Storage e TTL assinado.
 * O script rls-tenant-ab.js continua o relatório ao vivo (pode provisionar org B).
 * Este teste não grava. Login extra é skipped sem QA_*.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  RLS_TABLES,
  RLS_BUCKETS,
  PORTAL_RPCS,
  clampSignedTtl,
  SIGNED_TTL_MAX,
  interpretarRpcPortal,
} from "../js/utils/rls-prova.js";
import { credenciaisGoldenAuth } from "../js/utils/golden-flow-auth.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const creds = credenciaisGoldenAuth();

describe("rls continua storage rpc portal", () => {
  it("TTL assinado tem teto; token lixo não conta como dado", () => {
    assert.equal(clampSignedTtl(99999), SIGNED_TTL_MAX);
    assert.equal(clampSignedTtl(0), SIGNED_TTL_MAX);
    assert.equal(clampSignedTtl(-1), SIGNED_TTL_MAX);
    assert.equal(clampSignedTtl(120), 120);
    const vazou = interpretarRpcPortal({ data: [{ id: "x" }] });
    assert.equal(vazou.ok, false);
    const limpo = interpretarRpcPortal({ data: [], error: { code: "PGRST116" } });
    assert.equal(limpo.ok, true);
    const preliminar = interpretarRpcPortal({ data: [{ ia_preliminar: "segredo" }] });
    assert.equal(preliminar.ok, false);
  });

  it("probe e app cobrem buckets, RPCs e pacote; fotos clínicas não são públicas", () => {
    const probe = readFileSync(join(ROOT, "scripts/rls-tenant-ab.js"), "utf8");
    const url = readFileSync(join(ROOT, "js/core/storage-url.js"), "utf8");
    const fotos = readFileSync(join(ROOT, "routes/analise-pele-fotos.js"), "utf8");
    const evo = readFileSync(join(ROOT, "js/services/evolution-photos.service.js"), "utf8");
    const ana = readFileSync(join(ROOT, "js/services/anamnesis.service.js"), "utf8");
    assert.match(probe, /PORTAL_RPCS/);
    assert.match(probe, /RLS_BUCKETS/);
    assert.match(probe, /interpretarRpcPortal/);
    assert.ok(PORTAL_RPCS.includes("get_analises_pele_by_token"));
    assert.ok(RLS_TABLES.includes("client_packages"));
    assert.ok(RLS_BUCKETS.includes("client-photos"));
    assert.match(url, /clampSignedTtl/);
    assert.match(fotos, /clampSignedTtl/);
    assert.equal(evo.includes("getPublicUrl"), false);
    assert.equal(ana.includes("getPublicUrl"), false);
  });

  it("JWT master: RPC do portal com token lixo não devolve paciente", { skip: !creds.ok }, async () => {
    const supabase = createClient(creds.url, creds.anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: session, error: loginErr } = await supabase.auth.signInWithPassword({
      email: creds.email,
      password: creds.password,
    });
    assert.equal(loginErr, null, loginErr?.message || "login falhou");
    const falhas = [];
    for (const fn of PORTAL_RPCS) {
      const { data, error } = await supabase.rpc(fn, { p_token: "token-invalido-rls-probe" });
      const leitura = interpretarRpcPortal({ data, error });
      if (!leitura.ok) falhas.push(`${fn}:${leitura.detalhe}`);
    }
    assert.equal(falhas.length, 0, falhas.join("; "));
  });
});
