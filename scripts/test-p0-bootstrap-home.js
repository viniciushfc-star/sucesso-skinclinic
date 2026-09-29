/**
 * Home após login+org = Dashboard (cockpit). Agenda continua navegável.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("home pós-autenticação", () => {
  it("com organização o bootstrap vai para dashboard, não para agenda", () => {
    const boot = readFileSync(join(ROOT, "js/core/bootstrap.js"), "utf8");
    assert.match(boot, /return \{ next: "dashboard" \}/);
    assert.doesNotMatch(boot, /return \{ next: "agenda" \}/);
  });

  it("Agenda permanece rota explícita no SPA", () => {
    const spa = readFileSync(join(ROOT, "js/core/spa.js"), "utf8");
    assert.match(spa, /agenda:\s*\{/);
    assert.match(spa, /view: "agenda\.views\.js"/);
    assert.match(spa, /permission: "agenda:view"/);
    assert.match(spa, /dashboard:\s*\{/);
  });
});
