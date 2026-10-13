/**
 * Lote 82 — diagnóstico de compatibilidade e gêmeos. Sem DROP.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PARES_DUPLICADOS,
  TABELAS_NUCLEO,
  extrairCreateTable,
  extrairFrom,
  interpretarPar,
  tabelasOpenApi,
  veredicto,
} from "../js/utils/banco-compat.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function src(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("Lote 82 banco compat e duplicatas", () => {
  it("núcleo e pares canônico/legado estão definidos", () => {
    assert.ok(TABELAS_NUCLEO.includes("clients"));
    assert.ok(TABELAS_NUCLEO.includes("agenda"));
    const keys = PARES_DUPLICADOS.map((p) => `${p.canon}/${p.legado}`);
    assert.ok(keys.includes("clients/clientes"));
    assert.ok(keys.includes("agenda/appointments"));
    assert.ok(keys.includes("organization_invites/convites"));
    assert.ok(keys.includes("audit_logs/logs"));
  });

  it("interpreta gêmeos: só canônico ok; os dois cheios atenção; legado vazio candidato", () => {
    assert.equal(interpretarPar({ status: "EXISTE", count: 10 }, { status: "AUSENTE" }).nivel, "OK");
    assert.equal(interpretarPar({ status: "AUSENTE" }, { status: "EXISTE", count: 3 }).nivel, "FALTA");
    const vazio = interpretarPar({ status: "EXISTE", count: 10 }, { status: "EXISTE", count: 0 });
    assert.equal(vazio.nivel, "OK");
    assert.equal(vazio.limpar, true);
    const overlap = interpretarPar(
      { status: "EXISTE", count: 10 },
      { status: "EXISTE", count: 4 },
      { overlap: 2 }
    );
    assert.equal(overlap.nivel, "ATENCAO");
    assert.match(overlap.acao, /2 id/);
  });

  it("varre from/CREATE e OpenAPI; veredicto falha se o núcleo faltar", () => {
    const from = extrairFrom('x.from("clients"); y.from("agenda_waitlist")');
    assert.deepEqual(from, ["agenda_waitlist", "clients"]);
    const create = extrairCreateTable(
      "-- CREATE TABLE em nenhum outro script\nCREATE TABLE IF NOT EXISTS public.skincare_mercado_refs (id uuid);"
    );
    assert.deepEqual(create, ["skincare_mercado_refs"]);
    assert.deepEqual(tabelasOpenApi({ paths: { "/clients": {}, "/rpc/foo": {} } }), ["clients"]);
    assert.equal(veredicto({ nucleoFaltando: ["agenda"] }), "INCOMPATIVEL");
    assert.equal(veredicto({ nucleoFaltando: [], paresProblema: [{ nivel: "ATENCAO" }], appFaltando: [] }), "PARCIAL");
    assert.equal(veredicto({ nucleoFaltando: [], paresProblema: [], appFaltando: [] }), "COMPATIVEL");
  });

  it("SQL colar e CLI não dropam; npm tem banco:compat", () => {
    const sql = src("supabase/supabase-fase0-banco-compat-colar.sql");
    assert.match(sql, /pares\(canon, legado/);
    assert.match(sql, /count_public/);
    assert.match(sql, /COUNT\(\*\)/);
    assert.doesNotMatch(sql, /DROP TABLE/i);
    const cli = src("scripts/banco-compat.js");
    assert.match(cli, /diagnosticarBanco/);
    assert.doesNotMatch(cli, /DROP TABLE/);
    const pkg = src("package.json");
    assert.match(pkg, /banco:compat/);
    const limpa = src("supabase/supabase-fase0-banco-limpeza-colar.sql");
    assert.match(limpa, /ENABLE ROW LEVEL SECURITY/);
    assert.match(limpa, /anamnesis_tipos/);
    assert.match(limpa, /payment_fee_models/);
    assert.match(limpa, /COUNT\(\*\) FROM public\.appointments/);
    assert.match(limpa, /IF n = 0 THEN/);
    assert.doesNotMatch(limpa, /DROP TABLE public\.clientes/i);
    assert.doesNotMatch(limpa, /DROP TABLE public\.logs/i);
    assert.doesNotMatch(limpa, /DROP TABLE[\s\S]*CASCADE/i);
    const legado = src("supabase/supabase-fase0-banco-limpeza-legado-colar.sql");
    assert.match(legado, /legacy_cliente_id/);
    assert.match(legado, /DELETE FROM public\.clientes/);
    assert.match(legado, /org_id IS NULL/);
    assert.doesNotMatch(legado, /DROP TABLE public\.clients/i);
    assert.doesNotMatch(legado, /DROP TABLE public\.audit_logs/i);
  });
});
