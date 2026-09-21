/**
 * Fase 0 — regressão de isolamento (sem HTTP de produção).
 * npm test inclui este arquivo.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeRole } from "../js/core/permissions.map.js";
import { permissionAllowedByRoleForTest } from "../lib/api-auth.js";
import {
  hashPortalToken,
  isPortalSessionDevBypassEnabled,
  PORTAL_SESSION_TTL_MS,
} from "../lib/portal-token.js";
import { storageObjectPath } from "../js/core/storage-path.js";
import { statusAgendaItem } from "../js/services/cockpit-status.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function src(rel) {
  return readFileSync(join(root, rel), "utf8");
}

describe("Fase 0 — papel staff", () => {
  it("staff herda permissões de funcionario", () => {
    assert.equal(normalizeRole("staff"), "funcionario");
    assert.equal(permissionAllowedByRoleForTest("staff", "dashboard:view"), true);
    assert.equal(permissionAllowedByRoleForTest("staff", "financeiro:view"), false);
  });

  it("aliases de recepção e profissional", () => {
    assert.equal(normalizeRole("receptionist"), "recepcao");
    assert.equal(normalizeRole("recepção"), "recepcao");
    assert.equal(normalizeRole("professional"), "profissional");
  });
});

describe("Fase 0 — portal token e bypass", () => {
  it("hash é sha256 hex estável e diferente do token", () => {
    const token = "abc-token";
    const h = hashPortalToken(token);
    assert.equal(h.length, 64);
    assert.notEqual(h, token);
    assert.equal(hashPortalToken(token), h);
  });

  it("TTL é 7 dias", () => {
    assert.equal(PORTAL_SESSION_TTL_MS, 7 * 24 * 60 * 60 * 1000);
  });

  it("bypass do portal está off em production mesmo com o flag", () => {
    const prevDev = process.env.ALLOW_PORTAL_SESSION_DEV;
    const prevNode = process.env.NODE_ENV;
    const prevVercel = process.env.VERCEL_ENV;
    process.env.ALLOW_PORTAL_SESSION_DEV = "1";
    process.env.NODE_ENV = "production";
    delete process.env.VERCEL_ENV;
    assert.equal(isPortalSessionDevBypassEnabled(), false);
    process.env.VERCEL_ENV = "production";
    process.env.NODE_ENV = "development";
    assert.equal(isPortalSessionDevBypassEnabled(), false);
    if (prevDev == null) delete process.env.ALLOW_PORTAL_SESSION_DEV;
    else process.env.ALLOW_PORTAL_SESSION_DEV = prevDev;
    if (prevNode == null) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
    if (prevVercel == null) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prevVercel;
  });
});

describe("Fase 0 — storage path", () => {
  it("extrai path de URL pública antiga", () => {
    const url =
      "https://x.supabase.co/storage/v1/object/public/client-photos/org1/cli1/avatar.jpg";
    assert.equal(storageObjectPath("client-photos", url), "org1/cli1/avatar.jpg");
    assert.equal(storageObjectPath("client-photos", "org1/cli1/avatar.jpg"), "org1/cli1/avatar.jpg");
  });
});

describe("Cockpit — status da agenda", () => {
  it("marca atraso só se o horário já passou", () => {
    assert.equal(statusAgendaItem({ hora: "09:00" }, "10:00").key, "atraso");
    assert.equal(statusAgendaItem({ hora: "11:00" }, "10:00").key, "espera");
    assert.equal(statusAgendaItem({ status: "confirmed", hora: "09:00" }, "10:00").key, "ok");
  });
});

describe("Fase 0 — código", () => {
  it("logout limpa org e cache de role", () => {
    const auth = src("js/core/auth.js");
    assert.match(auth, /clearActiveOrg/);
    assert.match(auth, /clearRoleCache/);
  });

  it("backup usa clients e agenda", () => {
    const backup = src("js/services/backup.service.js");
    assert.match(backup, /"clients"/);
    assert.match(backup, /"agenda"/);
    assert.equal(backup.includes('"clientes"'), false);
    assert.equal(backup.includes('"agendamentos"'), false);
  });

  it("create-portal-session grava token_hash", () => {
    const route = src("routes/create-portal-session.js");
    assert.match(route, /token_hash/);
    assert.match(route, /isPortalSessionDevBypassEnabled/);
  });

  it("SW não é mais cache-first", () => {
    const sw = src("sw.js");
    assert.match(sw, /catch\(\(\) => caches\.match/);
    assert.doesNotMatch(sw, /return cached \|\| fetchPromise/);
  });

  it("agenda canônica: services não gravam mais em appointments", () => {
    const appt = src("js/services/appointments.service.js");
    const conf = src("js/services/confirmations.service.js");
    assert.equal(appt.includes('.from("appointments")'), false);
    assert.equal(conf.includes('.from("appointments")'), false);
    assert.match(appt, /\.from\("agenda"\)/);
  });

  it("convite legado Edge dynamic-api removido", () => {
    const user = src("js/services/user.service.js");
    assert.equal(user.includes("functions.invoke"), false);
    assert.match(user, /organization_invites/);
  });
});
