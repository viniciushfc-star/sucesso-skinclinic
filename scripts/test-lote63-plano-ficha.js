/**
 * Lote 63 — combinar plano terapêutico na ficha sem marcar horário.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resumoCicloOuroFicha } from "../js/utils/ciclo-ouro-ficha.js";
import { montarLinhaDoTempo } from "../js/utils/linha-tempo.js";
import {
  TIPO_PLANO_FICHA,
  payloadPlanoFicha,
  mesclarPlanosFicha,
  jaCombinouPlano,
  tituloPlanoFichaNaLinha,
} from "../js/utils/plano-ficha.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 63 plano na ficha sem horário", () => {
  it("evento usa client_events, sem preço e sem slot", () => {
    assert.equal(payloadPlanoFicha({}), null);
    assert.equal(payloadPlanoFicha({ clientId: "c1", planoId: "", nome: "X" }), null);
    const p = payloadPlanoFicha({ clientId: "c1", planoId: "p9", nome: "Oleosidade" });
    assert.equal(p.event_type, TIPO_PLANO_FICHA);
    assert.equal(p.client_id, "c1");
    assert.equal(p.metadata.plano_id, "p9");
    assert.equal(p.created_by_client, false);
    assert.equal(p.metadata.valor, undefined);
    assert.equal(p.metadata.agenda_id, undefined);
    assert.equal(payloadPlanoFicha({ clientId: "c1", planoId: "p9", nome: "ia_preliminar" }), null);
  });

  it("mescla evento na coluna combinado sem inventar sessão", () => {
    const merged = mesclarPlanosFicha(
      [{ id: "p1", nome: "Já na agenda", sessoes: [{ id: "a1" }] }],
      [
        { event_type: TIPO_PLANO_FICHA, metadata: { plano_id: "p1", nome: "dup" } },
        { event_type: TIPO_PLANO_FICHA, metadata: { plano_id: "p2", nome: "Novo" } },
      ],
      [{ id: "p2", nome: "QA ciclo ouro", procedimentos: [{ procedure_id: "x" }] }]
    );
    assert.equal(merged.length, 2);
    assert.equal(merged.find((p) => p.id === "p1").sessoes.length, 1);
    const novo = merged.find((p) => p.id === "p2");
    assert.equal(novo.nome, "QA ciclo ouro");
    assert.equal(novo.sessoes.length, 0);
    assert.equal(novo.origem, "ficha");
    const r = resumoCicloOuroFicha({ planosCliente: merged });
    assert.equal(r.colunas[0].itens.includes("Já na agenda"), true);
    assert.equal(r.colunas[0].itens.includes("QA ciclo ouro"), true);
    assert.equal(jaCombinouPlano([{ event_type: TIPO_PLANO_FICHA, metadata: { plano_id: "p2" } }], "p2"), true);
  });

  it("ficha grava o evento; linha do tempo nomeia sem rota Atendimentos", () => {
    assert.equal(tituloPlanoFichaNaLinha(TIPO_PLANO_FICHA), "Plano combinado");
    const items = montarLinhaDoTempo({
      events: [{ event_type: TIPO_PLANO_FICHA, description: "QA ciclo ouro", event_date: "2026-10-11" }],
    });
    assert.equal(items[0].titulo, "Plano combinado");
    const view = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(view, /btnCicloCombinarPlano/);
    assert.match(view, /mesclarPlanosFicha/);
    assert.match(view, /payloadPlanoFicha/);
    assert.doesNotMatch(view, /view-atendimentos|#atendimentos/);
    assert.doesNotMatch(view, /from\("planos_clientes"\)/);
  });
});
