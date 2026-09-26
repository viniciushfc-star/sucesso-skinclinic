import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  totalOrcamento,
  formatOrcamentoMensagem,
  linhaTotal,
  isOrcamentoExpirado,
  statusEfetivoOrcamento,
} from "../js/utils/orcamento.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("orçamento no paciente", () => {
  it("soma linhas e monta mensagem sem alterar preço", () => {
    const items = [
      { name: "Botox", qty: 1, unit_price: 800 },
      { name: "AH", qty: 2, unit_price: 500 },
    ];
    assert.equal(linhaTotal(items[1]), 1000);
    assert.equal(totalOrcamento(items), 1800);
    const msg = formatOrcamentoMensagem({
      nomeClinica: "Clínica X",
      nomeCliente: "Ana",
      items,
      validUntil: "2026-10-10",
    });
    assert.match(msg, /Ana, segue o orçamento/);
    assert.match(msg, /Total: R\$ 1800,00/);
    assert.match(msg, /10\/10\/2026/);
    const svc = readFileSync(join(ROOT, "js/services/orcamentos.service.js"), "utf8");
    assert.doesNotMatch(svc, /valor_cobrado\s*=/);
  });

  it("envio usa client_id e não lista de telefones", () => {
    const view = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(view, /origem: "orcamento"/);
    assert.match(view, /clientId: client\.id/);
    assert.match(view, /tabOrcamentos/);
    assert.match(view, /aceitarOrcamento/);
    const sql = readFileSync(join(ROOT, "supabase/migrations/20260925230000_p1_orcamentos.sql"), "utf8");
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.orcamentos/);
    assert.match(sql, /aceito/);
  });

  it("validade vencida aparece como expirado e não gera pacote", () => {
    const velho = { status: "enviado", valid_until: "2026-09-01" };
    assert.equal(isOrcamentoExpirado(velho, "2026-09-26"), true);
    assert.equal(statusEfetivoOrcamento(velho, "2026-09-26"), "expirado");
    assert.equal(isOrcamentoExpirado({ status: "aceito", valid_until: "2026-09-01" }, "2026-09-26"), false);
    assert.equal(isOrcamentoExpirado({ status: "enviado", valid_until: "2026-09-26" }, "2026-09-26"), false);
    const svc = readFileSync(join(ROOT, "js/services/orcamentos.service.js"), "utf8");
    assert.match(svc, /isOrcamentoExpirado/);
    const view = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(view, /statusEfetivoOrcamento/);
    assert.match(view, /Monte outro orçamento/);
  });
});
