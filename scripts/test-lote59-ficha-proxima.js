/**
 * Lote 59 — ficha: pacote no combinado; um próximo passo; aviso sem produto.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resumoCicloOuroFicha,
  proximaAcaoCicloFicha,
  aplicadoSemMaterial,
  sinaisInicioCiclo,
  rotuloPacoteCombinado,
} from "../js/utils/ciclo-ouro-ficha.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 59 ficha combinado e próxima ação", () => {
  it("pacote entra no combinado junto com o plano terapêutico", () => {
    const r = resumoCicloOuroFicha({
      planosCliente: [{ nome: "Oleosidade" }],
      pacotes: [{ nome_pacote: "6 sessões limpeza", total_sessoes: 6, sessoes_utilizadas: 2, sessoes_restantes: 4 }],
    });
    assert.equal(r.colunas[0].itens.includes("Oleosidade"), true);
    assert.match(r.colunas[0].itens.join(" "), /Pacote: 6 sessões limpeza/);
    assert.match(rotuloPacoteCombinado({ nome_pacote: "X", total_sessoes: 3, sessoes_utilizadas: 3 }), /encerrado/);
  });

  it("um passo por vez: registrar, depois baixa se avulso, pacote pago não pede cobrar", () => {
    const reg = proximaAcaoCicloFicha({
      planosCliente: [{ sessoes: [{ id: "a1", data: "2026-12-18" }] }],
      aplicados: [],
    });
    assert.equal(reg.tipo, "registrar");
    assert.equal(reg.agendaId, "a1");

    const baixa = proximaAcaoCicloFicha({
      aplicados: [{ agenda_id: "a1", descricao: "Botox" }],
      lancamentos: [],
      pacotes: [],
    });
    assert.equal(baixa.tipo, "baixa");

    const pago = proximaAcaoCicloFicha({
      aplicados: [{ agenda_id: "a1", descricao: "Botox" }],
      lancamentos: [],
      pacotes: [{ id: "pk", valor_pago: 900, total_sessoes: 6, sessoes_utilizadas: 1, sessoes_restantes: 5 }],
      temAgendaFutura: false,
      today: "2026-10-11",
    });
    assert.equal(pago.tipo, "proxima");
    assert.match(pago.titulo, /sessões/);

    const jaTem = proximaAcaoCicloFicha({
      aplicados: [{ agenda_id: "a1" }],
      pacotes: [{ valor_pago: 900, sessoes_restantes: 5 }],
      temAgendaFutura: true,
    });
    assert.equal(jaTem.tipo, null);
  });

  it("sinais e aviso de material sem travar", () => {
    assert.equal(aplicadoSemMaterial([{ descricao: "Botox", produtos_usados: [] }]), true);
    assert.equal(aplicadoSemMaterial([{ descricao: "Botox", produtos_usados: [{ produto_nome: "Toxina" }] }]), false);
    const s = sinaisInicioCiclo({ anamnese: [], analises: [{ status: "pending_validation" }] });
    assert.equal(s.anamneseOk, false);
    assert.match(s.pele, /pendente/);
    const ok = sinaisInicioCiclo({ anamnese: [{ id: "1" }], analises: [{ status: "validated" }] });
    assert.equal(ok.anamneseOk, true);
    assert.equal(ok.peleOk, true);
    const view = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(view, /btnCicloDarBaixa/);
    assert.match(view, /btnCicloProximaSessao/);
    assert.match(view, /agendaDefaultDate/);
    assert.doesNotMatch(view, /view-atendimentos|#atendimentos/);
  });
});
