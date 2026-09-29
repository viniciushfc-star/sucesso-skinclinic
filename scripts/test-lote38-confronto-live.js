/**
 * Lote 38 — confronto Git × live (tabelas, colunas, RPC, JWT SELECT).
 * Sem service key: skipped. Não grava.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";
import { confrontarLive } from "./confronto-git-live.js";

const hasService = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);

describe("confronto git live", () => {
  it("núcleo do Git existe no live; colunas/RPC relatados", { skip: !hasService }, async () => {
    const out = await confrontarLive();
    assert.equal(out.skip, "");
    assert.equal(out.ok, true, `núcleo ausente: ${(out.coreFaltando || []).map((t) => t.table).join(", ")}`);
    const { relatorio: r } = out;
    assert.ok(r.tabelas.length >= 40);
    const clients = r.tabelas.find((t) => t.table === "clients");
    const agenda = r.tabelas.find((t) => t.table === "agenda");
    assert.equal(clients?.status, "EXISTE");
    assert.equal(agenda?.status, "EXISTE");
    assert.ok(r.colunas.length >= 10);
    assert.ok(r.rpcs.length >= 3);
    if (r.jwt?.ok) {
      const falhaCore = (r.jwt.elos || []).filter((e) => !e.optional && !e.ok);
      assert.equal(falhaCore.length, 0, falhaCore.map((e) => `${e.id}:${e.detalhe}`).join("; "));
    }
  });
});
