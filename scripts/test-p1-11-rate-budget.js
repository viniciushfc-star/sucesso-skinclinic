/**
 * P1 — teto HTTP e reserva de orçamento de IA (mesmo isolate).
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bucketForPath,
  consumeRateLimit,
  resetRateLimitForTests,
  RATE_WINDOWS,
} from "../lib/http-rate-limit.js";
import { reserveBudget, releaseBudget, getCurrentMonthCostUsd } from "../lib/openai-cost.js";
import { BUDGET_USD_PER_USER_PER_MONTH } from "../lib/openai-config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("P1 rate limit HTTP", () => {
  beforeEach(() => resetRateLimitForTests());

  it("classifica IA, WhatsApp e portal", () => {
    assert.equal(bucketForPath("/api/copiloto"), "ai");
    assert.equal(bucketForPath("/api/analise-pele"), "ai");
    assert.equal(bucketForPath("/api/whatsapp-send"), "whatsapp");
    assert.equal(bucketForPath("/api/create-portal-session"), "portal");
    assert.equal(bucketForPath("/api/health"), null);
    assert.equal(bucketForPath("/api/audit-log"), null);
  });

  it("estoura o teto e devolve retry", () => {
    const max = RATE_WINDOWS.ai.max;
    for (let i = 0; i < max; i++) {
      assert.equal(consumeRateLimit("1.1.1.1", "ai").ok, true);
    }
    const blocked = consumeRateLimit("1.1.1.1", "ai");
    assert.equal(blocked.ok, false);
    assert.ok(blocked.retryAfterSec >= 1);
    assert.equal(consumeRateLimit("9.9.9.9", "ai").ok, true);
  });

  it("server aplica o teto no wrap", () => {
    const src = readFileSync(join(ROOT, "server.js"), "utf8");
    assert.match(src, /enforceHttpRateLimit/);
  });
});

describe("P1 orçamento IA com reserva", () => {
  it("segunda chamada paralela não fura o teto no mesmo processo", () => {
    const user = `test-budget-${Date.now()}`;
    const chunk = 0.4;
    let ok = 0;
    let blocked = 0;
    while (ok + blocked < 20) {
      const r = reserveBudget(user, chunk);
      if (r.ok) ok += 1;
      else {
        blocked += 1;
        break;
      }
    }
    assert.ok(ok >= 1);
    assert.ok(blocked === 1 || getCurrentMonthCostUsd(user) + chunk > BUDGET_USD_PER_USER_PER_MONTH);
    assert.ok(getCurrentMonthCostUsd(user) <= BUDGET_USD_PER_USER_PER_MONTH + 0.0001);
    releaseBudget(user, getCurrentMonthCostUsd(user));
  });
});
