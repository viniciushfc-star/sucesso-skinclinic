/**
 * Lote 3 — leitura operacional só em clients; clientes fica para LGPD de linha migrada.
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

describe("Lote 3 clients canônico", () => {
  it("listas e getClientById não leem a tabela clientes", () => {
    const svc = src("js/services/clientes.service.js");
    assert.equal(svc.includes('.from("clientes")'), false);
    assert.match(svc, /fonte canônica: clients/);
    assert.match(svc, /CLIENT_STATES/);
  });

  it("anamnese e protocolo aplicado não fazem fallback em clientes", () => {
    assert.equal(src("js/views/anamnese.views.js").includes('.from("clientes")'), false);
    assert.equal(src("js/services/protocolo-db.service.js").includes('.from("clientes")'), false);
  });

  it("métricas do dashboard contam só clients", () => {
    const m = src("js/services/metrics.service.js");
    assert.match(m, /load\("clients"\)/);
    assert.equal(m.includes('load("clientes")'), false);
  });

  it("LGPD ainda anonimiza PII residual em clientes pelo legacy_cliente_id", () => {
    const lgpd = src("js/services/lgpd.service.js");
    assert.match(lgpd, /from\("clientes"\)/);
    assert.match(lgpd, /legacy_cliente_id/);
  });
});
