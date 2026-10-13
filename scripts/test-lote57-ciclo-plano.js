/**
 * Lote 57 — CTA do setup abre planos terapêuticos; ficha separa combinado / receita / feito.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resumoCicloOuroFicha, slotPendenteDoPlano } from "../js/utils/ciclo-ouro-ficha.js";
import { compararPlanoVsAplicado } from "../js/utils/plano-vs-aplicado.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 57 ciclo plano terapêutico", () => {
  it("setup aponta Procedimentos e abre o bloco de planos, não a tela de assinar", () => {
    const setup = readFileSync(join(ROOT, "js/services/setup-progress.service.js"), "utf8");
    assert.match(setup, /id: "plano"/);
    assert.match(setup, /view: "procedimento"/);
    assert.match(setup, /openPlanos: true/);
    assert.doesNotMatch(setup, /id: "plano"[\s\S]{0,80}view: "planos"/);
    const spa = readFileSync(join(ROOT, "js/core/spa.js"), "utf8");
    assert.match(spa, /sc_open_planos/);
    const proc = readFileSync(join(ROOT, "js/views/procedimento.views.js"), "utf8");
    assert.match(proc, /openPlanosTerapeuticosPanel/);
    assert.match(proc, /financeiro:view/);
    const dash = readFileSync(join(ROOT, "js/views/dashboard.views.js"), "utf8");
    assert.match(dash, /data-open-planos/);
  });

  it("ficha descreve plano ≠ protocolo ≠ aplicado", () => {
    const r = resumoCicloOuroFicha({
      planosCliente: [{ nome: "Oleosidade" }],
      protocolos: [{ id: "p1", nome: "Limpeza profunda" }],
      aplicados: [{ protocolo_id: "p1", protocolos: { nome: "Limpeza profunda" }, descricao: "Sessão 1" }],
    });
    assert.equal(r.colunas[0].itens[0], "Oleosidade");
    assert.equal(r.colunas[1].itens[0], "Limpeza profunda");
    assert.equal(r.colunas[2].itens[0], "Limpeza profunda");
    const vazio = resumoCicloOuroFicha({});
    assert.match(vazio.colunas[0].vazio, /plano terapêutico/);
    const view = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(view, /renderCicloOuroFicha/);
    assert.match(view, /listPlanosDoCliente/);
  });

  it("plano terapêutico na agenda entra na divergência sem travar", () => {
    const d = compararPlanoVsAplicado({
      planos: [{ nome: "Oleosidade", sessoes_utilizadas: 1 }],
      aplicados: [],
    });
    assert.equal(d.temDivergencia, true);
    assert.equal(d.linhas[0].tipo, "consumo_sem_aplicado");
  });

  it("sessão do plano vira receita; aplicado preenche o feito", () => {
    const antes = resumoCicloOuroFicha({
      planosCliente: [{ nome: "QA ciclo ouro", sessoes: [{ id: "a1", procedimento: "Botox", data: "2026-12-18" }] }],
      aplicados: [],
    });
    assert.equal(antes.colunas[1].itens[0], "Botox");
    assert.equal(antes.colunas[2].itens.length, 0);
    const depois = resumoCicloOuroFicha({
      planosCliente: [{ nome: "QA ciclo ouro", sessoes: [{ id: "a1", procedimento: "Botox" }] }],
      aplicados: [{ agenda_id: "a1", descricao: "Botox", produtos_usados: [{ produto_nome: "Toxina" }] }],
    });
    assert.equal(depois.colunas[2].itens.includes("Botox"), true);
    assert.equal(depois.colunas[2].itens.includes("Toxina"), true);
    assert.equal(slotPendenteDoPlano([{ sessoes: [{ id: "a1", data: "2026-12-18" }] }], [{ agenda_id: "a1" }]), null);
    const view = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(view, /btnCicloRegistrarAplicado/);
    assert.match(view, /agendaOpenAplicado/);
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(agenda, /agendaOpenAplicado/);
  });

  it("ficha agenda com plano já escolhido, sem tela nova", () => {
    const view = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(view, /btnCicloAgendarPlano/);
    assert.match(view, /agendaPrefillPlanoId/);
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(agenda, /agendaPrefillPlanoId/);
    assert.match(agenda, /agenda-modal-mais/);
    assert.doesNotMatch(view, /view-atendimentos|#atendimentos/);
  });
});
