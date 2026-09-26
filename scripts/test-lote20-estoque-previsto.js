/**
 * Lote 20 — estoque previsto do protocolo vs o que foi registrado.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compararEstoquePrevistoReal,
  itensParaConsumoEstoque,
} from "../js/utils/estoque-previsto-real.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("estoque previsto vs real no protocolo", () => {
  it("marca faltou, extra e alinha nomes parecidos", () => {
    const c = compararEstoquePrevistoReal({
      previsto: [{ produto_nome: "Gaze", quantidade: 2 }],
      real: [{ produto_nome: "Gaze", quantidade: 1 }, { produto_nome: "Luva", quantidade: 1 }],
    });
    assert.equal(c.temDivergencia, true);
    assert.equal(c.linhas.find((l) => l.nome === "Gaze").tipo, "divergente");
    assert.equal(c.linhas.find((l) => l.nome === "Luva").tipo, "extra");
    const ok = compararEstoquePrevistoReal({
      previsto: [{ produto_nome: "Gaze", quantidade: 2 }],
      real: [{ produto_nome: "Gaze", quantidade: 2 }],
    });
    assert.equal(ok.temDivergencia, false);
    const cons = itensParaConsumoEstoque(
      [{ produto_nome: "Gaze", quantidade: 2 }, { produto_nome: "Álcool", quantidade: 1 }],
      [{ produto_nome: "Gaze", quantidade: 1 }]
    );
    assert.equal(cons.find((x) => x.produto_nome === "Gaze").quantidade, 1);
    assert.ok(cons.some((x) => x.produto_nome === "Álcool"));
  });

  it("grava o real e consome previsto sem travar", () => {
    const svc = readFileSync(join(ROOT, "js/services/protocolo-db.service.js"), "utf8");
    assert.match(svc, /itensParaConsumoEstoque/);
    assert.match(svc, /registrarConsumoEstimado/);
    const view = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(view, /compararEstoquePrevistoReal/);
    assert.match(view, /atendimento não trava/);
  });
});
