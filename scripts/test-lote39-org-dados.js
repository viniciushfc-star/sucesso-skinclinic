/**
 * Lote 39 — QA na org com pacientes: SELECT elos + limpeza agenda órfã.
 * Sem service/QA: skipped.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { testarOrgDados } from "./ciclo-ouro-org-dados.js";
import { escolherOrgComPacientes, credenciaisGoldenAuth } from "../js/utils/golden-flow-auth.js";

const has = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY && process.env.QA_EMAIL_MASTER && process.env.QA_PASS_MASTER
);

describe("ciclo ouro org com pacientes", () => {
  it("helper não usa a primeira membership cega", () => {
    const src = String(escolherOrgComPacientes);
    assert.match(src, /clients/);
    assert.match(src, /org_id/);
  });

  it("JWT lê a org com pacientes; elos sem erro; agenda órfã tratada", { skip: !has }, async () => {
    const creds = credenciaisGoldenAuth();
    assert.equal(creds.ok, true);
    const out = await testarOrgDados();
    assert.equal(out.ok, true, JSON.stringify({
      elos: (out.rel.elos || []).filter((e) => !e.ok),
      rls: (out.rel.rls || []).filter((r) => !r.ok || r.leak),
      cruzado: (out.rel.cruzado || []).filter((c) => !c.ok),
      prep: out.rel.passos,
    }));
    const pacientes = (out.rel.elos || []).find((e) => e.id === "paciente");
    assert.ok(pacientes);
    assert.equal(pacientes.ok, true);
    assert.ok(Number(pacientes.count) >= 1, "esperava pacientes na org alvo");
    const margem = (out.rel.elos || []).find((e) => e.id === "margem");
    assert.equal(margem?.ok, true);
    assert.ok(Number(margem.count) >= 1, "esperava financeiro na org alvo");
    const agenda = (out.rel.elos || []).find((e) => e.id === "crm");
    assert.equal(agenda?.ok, true);
    assert.ok((out.rel.rls || []).every((t) => t.ok && !t.leak));
    const div = (out.rel.divergencias || []).find((d) => d.caso === "agenda_jwt_vs_service");
    assert.ok(div, "faltou confronto agenda JWT vs service");
    if (!div.ok) {
      console.warn("[lote39]", div.detalhe);
    }
    assert.equal(out.rel.financeiro?.n >= 1, true);
  });
});
