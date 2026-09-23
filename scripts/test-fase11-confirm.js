/**
 * Confirmação do link marca a agenda; markdown do estudo de caso escapa HTML.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("confirmação de horário e XSS do estudo de caso", () => {
  it("RPC oficial grava confirmed_at na agenda da mesma org", () => {
    const sql = readFileSync(
      join(ROOT, "supabase/migrations/20260923060000_p1_confirm_agenda.sql"),
      "utf8"
    );
    assert.match(sql, /ADD COLUMN IF NOT EXISTS confirmed_at/);
    assert.match(sql, /UPDATE public\.agenda/);
    assert.match(sql, /org_id = v_row\.org_id/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION public.confirm_appointment_by_token/);
  });

  it("estudo de caso escapa o texto antes de virar HTML", () => {
    const src = readFileSync(join(ROOT, "js/views/estudo-caso.views.js"), "utf8");
    assert.match(src, /s = escapeHtml\(s\)/);
    assert.match(src, /x00L/);
  });
});
