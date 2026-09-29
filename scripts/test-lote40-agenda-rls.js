/**
 * Lote 40 — RLS agenda/confirmação por membership, sem app.org_id.
 * SQL colar + cron de silêncio importa o util.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("rls agenda membership", () => {
  it("colar e migration derrubam todas as policies e não usam app.org_id", () => {
    const colar = readFileSync(join(ROOT, "supabase/supabase-agenda-rls-colar.sql"), "utf8");
    const mig = readFileSync(join(ROOT, "supabase/migrations/20260927020000_p0_agenda_confirm_rls_org.sql"), "utf8");
    const legado = readFileSync(join(ROOT, "supabase/supabase-rls-agenda.sql"), "utf8");
    for (const sql of [colar, mig]) {
      assert.match(sql, /DROP POLICY IF EXISTS %I ON public\.agenda/);
      assert.match(sql, /appointment_confirmations/);
      assert.match(sql, /organization_users WHERE user_id = auth\.uid\(\)/);
      assert.doesNotMatch(sql, /current_setting\s*\(\s*'app\.org_id'/);
    }
    assert.match(legado, /DROP POLICY IF EXISTS %I ON public\.agenda/);
    assert.doesNotMatch(legado, /current_setting\s*\(\s*'app\.org_id'/);
  });
});
