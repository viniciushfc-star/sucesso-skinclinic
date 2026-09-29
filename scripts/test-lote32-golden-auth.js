/**
 * Lote 32 — ciclo ouro autenticado: JWT anon + SELECT por org. Não grava.
 * Sem QA_EMAIL_MASTER / QA_PASS_MASTER o teste ao vivo é skipped.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  elosGoldenParaLeitura,
  interpretarLeituraElo,
  credenciaisGoldenAuth,
  escolherOrgComPacientes,
} from "../js/utils/golden-flow-auth.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const creds = credenciaisGoldenAuth();

describe("ciclo ouro autenticado", () => {
  it("plano de leitura não muta e não usa service role no cliente", () => {
    const elos = elosGoldenParaLeitura();
    assert.ok(elos.some((e) => e.table === "clients"));
    assert.ok(elos.some((e) => e.table === "orcamentos"));
    const r = interpretarLeituraElo({ count: 0 });
    assert.equal(r.ok, true);
    assert.equal(r.estado, "vazio");
    const ausente = interpretarLeituraElo({
      error: { code: "PGRST205", message: "does not exist" },
      optional: true,
    });
    assert.equal(ausente.ok, true);
    const coreSumiu = interpretarLeituraElo({
      error: { code: "PGRST205", message: "does not exist" },
      optional: false,
    });
    assert.equal(coreSumiu.ok, false);
    const src = readFileSync(join(ROOT, "js/utils/golden-flow-auth.js"), "utf8");
    const testSrc = readFileSync(join(ROOT, "scripts/test-lote32-golden-auth.js"), "utf8");
    assert.doesNotMatch(src, /createClient/);
    assert.doesNotMatch(src, /signInWithPassword/);
    assert.match(testSrc, /creds\.anon/);
    assert.match(testSrc, /head: true/);
    assert.match(testSrc, /signInWithPassword/);
  });

  it("login master lê cada elo da org (SELECT)", { skip: !creds.ok }, async () => {
    const supabase = createClient(creds.url, creds.anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: session, error: loginErr } = await supabase.auth.signInWithPassword({
      email: creds.email,
      password: creds.password,
    });
    assert.equal(loginErr, null, loginErr?.message || "login falhou");
    assert.ok(session?.session?.access_token, "sem JWT");

    const uid = session.user?.id;
    assert.ok(uid);

    const pick = await escolherOrgComPacientes(supabase);
    assert.equal(pick.ok, true, pick.detalhe || "sem org");
    const orgId = pick.orgId;
    assert.ok(orgId, "usuário QA sem org");

    const falhas = [];
    for (const elo of elosGoldenParaLeitura()) {
      const { error, count } = await supabase
        .from(elo.table)
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId);
      const leitura = interpretarLeituraElo({ error, count, optional: elo.optional });
      if (!leitura.ok) falhas.push(`${elo.id}:${leitura.detalhe}`);
    }

    await supabase.auth.signOut();
    assert.equal(falhas.length, 0, falhas.join(" | "));
  });
});
