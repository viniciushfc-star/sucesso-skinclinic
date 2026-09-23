/**
 * Lote 9 — UX/perf da operação do dia: overlay espera a tela, membros em cache,
 * lista de clientes mais leve, agenda não busca o mesmo dia duas vezes.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 9 UX e desempenho", () => {
  it("SPA espera o init e não rebinda o sino a cada tela", () => {
    const spa = readFileSync(join(ROOT, "js/core/spa.js"), "utf8");
    assert.match(spa, /await module\.init\(\)/);
    assert.match(spa, /__scNotifBound/);
    assert.match(spa, /import\("\.\.\/views\/agenda\.views\.js"\)/);
  });

  it("membros da org têm cache e logout limpa", () => {
    const org = readFileSync(join(ROOT, "js/core/org.js"), "utf8");
    const auth = readFileSync(join(ROOT, "js/core/auth.js"), "utf8");
    assert.match(org, /invalidateOrgMembersCache/);
    assert.match(org, /MEMBERS_TTL_MS/);
    assert.match(org, /clearActiveOrg[\s\S]{0,80}invalidateOrgMembersCache|invalidateOrgMembersCache[\s\S]{0,40}removeItem/);
    assert.match(auth, /clearActiveOrg\(\)/);
  });

  it("clientes: busca no servidor e lista sem select *", () => {
    const svc = readFileSync(join(ROOT, "js/services/clientes.service.js"), "utf8");
    const view = readFileSync(join(ROOT, "js/views/clientes.views.js"), "utf8");
    assert.match(svc, /name\.ilike\.%\$\{safe\}%/);
    assert.match(svc, /id, name, email, phone, cpf, state/);
    assert.match(view, /limit:\s*250/);
  });

  it("agenda reusa a semana no dia e o SW continua network-first", () => {
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
    assert.match(agenda, /weekItems/);
    assert.match(agenda, /export async function init/);
    assert.match(sw, /catch\(\(\) => caches\.match/);
    assert.match(sw, /v6/);
  });
});
