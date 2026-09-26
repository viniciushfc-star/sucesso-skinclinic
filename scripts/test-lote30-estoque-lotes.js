/**
 * Lote 30 — lotes, perdas e conferência no estoque canônico. Sem travar atendimento.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  conferirInventario,
  payloadAjustePorInventario,
  payloadPerda,
  lotesComSaldo,
  capitalEstoque,
  alertaMinimo,
  TIPO_AJUSTE,
} from "../js/utils/estoque-lotes.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("estoque lotes perdas inventario", () => {
  it("FIFO por validade e perda vira ajuste; sobra não inventa entrada", () => {
    const lotes = lotesComSaldo(
      [
        { produto_nome: "Gaze", lote: "A", data_validade: "2026-10-01", quantidade: 5 },
        { produto_nome: "Gaze", lote: "B", data_validade: "2026-12-01", quantidade: 5 },
      ],
      [{ produto_nome: "Gaze", quantidade: 6 }]
    );
    const a = lotes.find((l) => l.lote === "A");
    const b = lotes.find((l) => l.lote === "B");
    assert.equal(a.saldo, 0);
    assert.equal(b.saldo, 4);
    const perda = payloadPerda("Gaze", 2, { motivo: "vencido" });
    assert.equal(perda.tipo, TIPO_AJUSTE);
    const ok = conferirInventario(10, 10);
    assert.equal(ok.sentido, "ok");
    const falta = conferirInventario(10, 7);
    assert.equal(falta.sentido, "faltou");
    assert.equal(payloadAjustePorInventario("Gaze", falta).quantidade, 3);
    const sobra = conferirInventario(10, 12);
    assert.equal(sobra.sentido, "sobrou");
    assert.equal(payloadAjustePorInventario("Gaze", sobra), null);
    assert.equal(alertaMinimo(2, 5).nivel, "abaixo");
    const cap = capitalEstoque([{ saldo: 10, custo_medio: 4, minimo: 3 }]);
    assert.equal(cap.investido, 40);
    assert.equal(cap.acimaMinimo, 28);
    const semPiso = capitalEstoque([{ saldo: 10, custo_medio: 4 }]);
    assert.equal(semPiso.investido, 40);
    assert.equal(semPiso.acimaMinimo, null);
  });

  it("tela registra perda e inventário sem travar; SQL só adiciona coluna", () => {
    const view = readFileSync(join(ROOT, "js/views/estoque.views.js"), "utf8");
    const sql = readFileSync(join(ROOT, "supabase/supabase-estoque-lotes-colar.sql"), "utf8");
    assert.match(view, /btnEstoquePerda/);
    assert.match(view, /Não trava atendimento/);
    assert.match(view, /não inventa estoque/);
    assert.match(sql, /quantidade_minima/);
    assert.doesNotMatch(sql, /DROP TABLE/i);
    assert.doesNotMatch(view, /estoque2/);
  });
});
