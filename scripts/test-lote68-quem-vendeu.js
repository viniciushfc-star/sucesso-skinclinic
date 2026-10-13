/**
 * Lote 68 — quem vendeu ≠ quem aplica; análise, sem pagar.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 68 quem vendeu", () => {
  it("agenda e orçamento gravam sold_by_user_id sem misturar com quem aplica", () => {
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(agenda, /function htmlQuemVendeuSelect/);
    assert.match(agenda, /id="soldByUser"/);
    assert.match(agenda, /sold_by_user_id: readSoldByUserId\(\)/);
    assert.match(agenda, /Vendeu:/);
    assert.match(agenda, /A mesma que aplica/);
    assert.match(readFileSync(join(ROOT, "js/services/appointments.service.js"), "utf8"), /soldByUserId/);
    assert.match(readFileSync(join(ROOT, "js/services/orcamentos.service.js"), "utf8"), /sold_by_user_id/);
    assert.match(readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8"), /orcamentoSoldBy/);
  });

  it("comissão de aplicar continua no horário; venda é coluna à parte", () => {
    const svc = readFileSync(join(ROOT, "js/services/comissoes.service.js"), "utf8");
    assert.match(svc, /sold_by_user_id/);
    assert.match(svc, /receitaFechada/);
    assert.match(readFileSync(join(ROOT, "js/views/financeiro.views.js"), "utf8"), /Receita que fechou/);
    const sql = readFileSync(join(ROOT, "supabase/supabase-fase0-quem-vendeu-colar.sql"), "utf8");
    assert.match(sql, /sold_by_user_id/);
    assert.doesNotMatch(sql, /service_role/);
  });
});
