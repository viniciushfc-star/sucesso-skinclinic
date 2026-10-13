/**
 * Lote 18 — linha do tempo unificada, interno vs portal, sem ia_preliminar.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { montarLinhaDoTempo, visibilidadeAnamnese } from "../js/utils/linha-tempo.js";
import { payloadSessaoProntuario, TIPO_SESSAO_PRONTUARIO } from "../js/utils/prontuario-sessao.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("linha do tempo do prontuário", () => {
  it("separa portal e interno e esconde ia_preliminar", () => {
    assert.equal(visibilidadeAnamnese("portal"), "portal");
    assert.equal(visibilidadeAnamnese("clinica"), "interno");
    const items = montarLinhaDoTempo({
      events: [
        { event_type: "crm_desfecho", description: "CRM: Falei", event_date: "2026-09-20" },
        { event_type: "Relato", description: "Dor", event_date: "2026-09-21", created_by_client: true },
        { event_type: "ia_preliminar", description: "não mostrar", event_date: "2026-09-22" },
      ],
      anamnese: [{ origem: "portal", created_at: "2026-09-19", anamnesis_funcoes: { nome: "Pele" }, conteudo: "manchas" }],
      aplicados: [{ aplicado_em: "2026-09-18", descricao: "Laser", produtos_usados: [{ produto_nome: "Luva nitrilo", quantidade: 0.06 }], protocolos: { nome: "Laser" }, observacao: "Intercorrência: eritema" }],
      orcamentos: [{ status: "enviado", created_at: "2026-09-17", valid_until: "2026-12-01" }],
      hoje: "2026-09-26",
    });
    assert.equal(items.some((i) => /ia_preliminar/i.test(i.titulo + i.detalhe)), false);
    assert.equal(items.find((i) => i.fonte === "anamnese")?.visibilidade, "portal");
    const apl = items.find((i) => i.fonte === "aplicado");
    assert.equal(apl?.visibilidade, "interno");
    assert.match(apl?.detalhe || "", /Luva nitrilo/);
    assert.equal(apl?.critico, true);
    assert.equal(items.find((i) => i.fonte === "evento" && i.titulo === "Relato")?.visibilidade, "portal");
    assert.ok(items.some((i) => i.fonte === "orcamento"));
  });

  it("sessão vai para o prontuário com produtos e intercorrência", () => {
    const p = payloadSessaoProntuario({
      procedimento: "limpeza de pele",
      produtos: [{ produto_nome: "Luva nitrilo caixa 100", quantidade: 0.06 }],
      intercorrencia: "eritema leve",
      agendaId: "ag-1",
    });
    assert.equal(p.event_type, TIPO_SESSAO_PRONTUARIO);
    assert.equal(p.is_critical, true);
    assert.match(p.description, /limpeza de pele/);
    assert.match(p.description, /Luva nitrilo/);
    assert.match(p.description, /Intercorrência/);
    assert.doesNotMatch(p.description, /ia_preliminar/);
  });

  it("perfil usa a linha unificada", () => {
    const view = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(view, /montarLinhaDoTempo/);
    assert.match(view, /data-filtro="portal"/);
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(agenda, /garantirAplicadoNoProntuario/);
    assert.match(agenda, /baixaIntercorrencia/);
    assert.doesNotMatch(view, /ia_preliminar/);
  });
});
