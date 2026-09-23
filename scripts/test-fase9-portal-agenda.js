/**
 * FASE 9 — agendamento do portal: duração ocupa a grade, não só o mesmo minuto.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFreeSlots } from "../js/utils/portal-slots.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("FASE 9 portal agendamento", () => {
  it("migration oficial recusa sobreposição por duração", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20260923050000_p0_portal_agendamento.sql"),
      "utf8"
    );
    assert.match(sql, /create_portal_appointment/);
    assert.match(sql, /make_interval\(mins => v_dur\)/);
    assert.match(sql, /list_portal_busy_hours/);
    assert.match(sql, /duration_minutes int/);
    assert.match(sql, /REVOKE ALL ON FUNCTION public.create_portal_appointment/);
    assert.doesNotMatch(sql, /CREATE TABLE public\.agenda/);
  });

  it("grade esconde 10:00 se 09:00 já ocupa 90 minutos", () => {
    const free = buildFreeSlots(
      [{ hora: "09:00", duration_minutes: 90 }],
      "2099-01-15",
      60
    );
    assert.equal(free.includes("09:00"), false);
    assert.equal(free.includes("09:30"), false);
    assert.equal(free.includes("10:00"), false);
    assert.equal(free.includes("10:30"), true);
  });

  it("procedimento de 90 min não cabe em 17:00", () => {
    const free = buildFreeSlots([], "2099-01-15", 90);
    assert.equal(free.includes("17:00"), false);
    assert.equal(free.includes("16:30"), true);
  });
});
