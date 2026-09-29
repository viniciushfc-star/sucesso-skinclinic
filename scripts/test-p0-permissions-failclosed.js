/**
 * Papel desconhecido ou viewer sem mapa → zero permissões (fail-closed).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROLE_PERMISSIONS, normalizeRole } from "../js/core/permissions.map.js";

function allows(role, permission) {
  if (normalizeRole(role) === "master" || role === "master") return true;
  const allowed = ROLE_PERMISSIONS[normalizeRole(role)] || ROLE_PERMISSIONS[role] || [];
  return allowed.includes(permission);
}

describe("permissões fail-closed", () => {
  it("recepção não vê financeiro; profissional não dispara WhatsApp", () => {
    assert.equal(allows("recepcao", "financeiro:view"), false);
    assert.equal(allows("profissional", "whatsapp:send"), false);
    assert.equal(allows("funcionario", "agenda:manage"), false);
  });

  it("papel sem entrada no mapa não herda gestor", () => {
    assert.equal(ROLE_PERMISSIONS.viewer, undefined);
    assert.equal((ROLE_PERMISSIONS["inexistente"] || []).length, 0);
    assert.equal(allows("viewer", "dashboard:view"), false);
    assert.equal(allows("inexistente", "agenda:view"), false);
  });
});
