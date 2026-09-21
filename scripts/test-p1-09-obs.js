/**
 * P1-9 — observabilidade (sem HTTP real).
 * npm test inclui este arquivo.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeObsMessage,
  shouldPersistApiEvent,
  isUuid,
} from "../lib/observability.js";

describe("P1-9 observabilidade", () => {
  it("não persiste 4xx comum; persiste 5xx e webhook_fail", () => {
    assert.equal(shouldPersistApiEvent(400, "api_5xx"), false);
    assert.equal(shouldPersistApiEvent(401, "api_5xx"), false);
    assert.equal(shouldPersistApiEvent(500, "api_5xx"), true);
    assert.equal(shouldPersistApiEvent(401, "webhook_fail"), true);
  });

  it("redige token e chave no recorte da mensagem", () => {
    const out = sanitizeObsMessage("Bearer abc.def.ghi falhou sk-abc123xyz e eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaaa");
    assert.equal(out.includes("Bearer [redacted]"), true);
    assert.equal(out.includes("[key]"), true);
    assert.equal(out.includes("sk-abc"), false);
    assert.ok(out.length <= 180);
  });

  it("uuid só no formato canônico", () => {
    assert.equal(isUuid("00000000-0000-4000-8000-000000000099"), true);
    assert.equal(isUuid("nao-uuid"), false);
  });
});
