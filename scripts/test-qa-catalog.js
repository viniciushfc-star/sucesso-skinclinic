import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog, catalogStats, ROLES, API_PERM } from "./qa/catalog.js";

describe("catálogo QA SkinClinic", () => {
  const cases = buildCatalog();
  const stats = catalogStats(cases);

  it("tem pelo menos 1200 tipos distintos", () => {
    assert.ok(stats.total >= 1200, `só ${stats.total} casos`);
  });

  it("ids únicos", () => {
    const ids = cases.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("cobre os 3 logins (papéis)", () => {
    for (const role of ROLES) {
      assert.ok(cases.some((c) => c.role === role), `falta papel ${role}`);
    }
  });

  it("cobre APIs de IA/WhatsApp/portal por papel", () => {
    assert.ok(API_PERM["/api/copiloto"].funcionario === false);
    assert.ok(API_PERM["/api/create-portal-session"].funcionario === false);
    assert.ok(API_PERM["/api/whatsapp-send"].gestor === true);
  });

  it("tem bateria anônima executável na Vercel", () => {
    const live = cases.filter((c) => ["anon", "anon-light", "cors", "anon-header"].includes(c.live));
    assert.ok(live.length >= 700, `só ${live.length} probes anônimos`);
  });
});
