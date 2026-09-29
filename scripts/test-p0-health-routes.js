/**
 * Health não mascara falha de rota crítica.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { healthPayload, CRITICAL_API_ROUTES } from "../lib/api-health.js";

describe("health e rotas críticas", () => {
  it("sem erros de load: 200 ok", () => {
    const r = healthPayload([]);
    assert.equal(r.status, 200);
    assert.equal(r.body.ok, true);
    assert.equal(r.body.service, "skinclinic-api");
  });

  it("com erro em rota crítica: 503 e ok false", () => {
    const r = healthPayload(["/api/create-portal-session: boom"]);
    assert.equal(r.status, 503);
    assert.equal(r.body.ok, false);
    assert.deepEqual(r.body.criticalRouteErrors, ["/api/create-portal-session: boom"]);
  });

  it("portal, lembretes e whatsapp-send são críticos; copiloto não", () => {
    assert.ok(CRITICAL_API_ROUTES.includes("/api/create-portal-session"));
    assert.ok(CRITICAL_API_ROUTES.includes("/api/lembretes-auto"));
    assert.ok(CRITICAL_API_ROUTES.includes("/api/whatsapp-send"));
    assert.equal(CRITICAL_API_ROUTES.includes("/api/copiloto"), false);
    assert.equal(CRITICAL_API_ROUTES.includes("/api/ocr"), false);
  });
});
