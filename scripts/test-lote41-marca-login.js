import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND_MARK_SVG } from "../js/core/brand.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("marca e polish de login", () => {
  it("login mantém wordmark sem o símbolo de três círculos", () => {
    assert.equal(BRAND_MARK_SVG, "");
    const index = readFileSync(join(ROOT, "index.html"), "utf8");
    assert.doesNotMatch(index, /<circle/i);
    assert.doesNotMatch(index, /brand-mark/);
    assert.match(index, /id="loginForm"/);
    assert.match(index, /id="btnGoogle"/);
    assert.match(index, /id="registerBtn"/);
    assert.match(index, /Beleza com propósito/i);
    assert.match(index, /Acesso ao sistema/);
    const css = readFileSync(join(ROOT, "js/css/style.css"), "utf8");
    assert.match(css, /--sc-blue:\s*#4e54c8/);
    assert.match(css, /--sc-violet:\s*#4f46e5/);
    const dash = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.doesNotMatch(dash, /<circle/i);
  });
});
