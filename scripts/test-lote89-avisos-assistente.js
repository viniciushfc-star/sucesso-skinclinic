/**
 * Lote 89 — avisos com org; assistente barato; estudo de caso sem paper inventado.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { recusarAvisoSemOrg, deveCriarAviso, mensagemAviso, TITULO_AVISO } from "../js/utils/avisos-clinica.js";
import {
  truncarPerguntaCopiloto,
  MAX_PERGUNTA_COPILOTO,
  explicarFichaLocal,
  respostaLocalCopiloto,
  deveChamarModeloCopiloto,
} from "../js/utils/copiloto-coeso.js";
import { SISTEMA_ESTUDO_CASO, promptEstudoCasoPergunta } from "../js/utils/estudo-caso-ia.js";
import { intentConsultora, responderConsultora, montarFatosConsultora } from "../js/utils/ia-consultora.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 89 avisos e assistente coeso", () => {
  it("aviso exige org e não duplica não lida", () => {
    assert.equal(recusarAvisoSemOrg(""), true);
    assert.equal(recusarAvisoSemOrg("org-1"), false);
    assert.equal(deveCriarAviso({ qtd: 2, jaExisteNaoLida: false }), true);
    assert.equal(deveCriarAviso({ qtd: 2, jaExisteNaoLida: true }), false);
    assert.equal(deveCriarAviso({ qtd: 0, jaExisteNaoLida: false }), false);
    assert.match(mensagemAviso("espera", 3), /3 pessoa/);
    assert.match(TITULO_AVISO.sem_responsavel, /responsável/);
  });

  it("assistente responde ficha e melhoria sem modelo; pergunta curta", () => {
    assert.equal(truncarPerguntaCopiloto("a".repeat(400)).length, MAX_PERGUNTA_COPILOTO);
    const local = explicarFichaLocal("Combinado: Oleosidade\nNão grave preço, não mande WhatsApp, não decida o tratamento.");
    assert.match(local, /Oleosidade/);
    assert.doesNotMatch(local, /DOI/);
    assert.equal(
      deveChamarModeloCopiloto({ consultora: { texto: "ok" }, origemFicha: false }),
      false
    );
    assert.match(
      respostaLocalCopiloto({ pergunta: "explique esta ficha", contexto: { origem: "ficha", mensagem: "Feito: LED" } }),
      /LED/
    );
    const fatos = montarFatosConsultora({ clientesTotal: 12, agendaTotal: 8, financeiroPorTipo: { entrada: 100 } });
    assert.equal(intentConsultora("como melhorar a clinica"), "melhoria");
    const m = responderConsultora("como melhorar a clinica", fatos);
    assert.match(m.texto, /12 clientes/);
    assert.match(m.texto, /não decide/i);
  });

  it("estudo de caso não pede paper inventado; spa sincroniza avisos; FAB gated", () => {
    assert.match(SISTEMA_ESTUDO_CASO, /Não invente DOI/);
    const p = promptEstudoCasoPergunta({
      caso_resumo: { tipo_pele: "oleosa", resposta_observada: "melhora" },
      pergunta: "por que melhorou?",
    });
    assert.match(p, /oleosa/);
    assert.match(p, /Não invente artigo/);
    const spa = readFileSync(join(ROOT, "js/core/spa.js"), "utf8");
    assert.match(spa, /sincronizarAvisosClinica/);
    assert.match(spa, /applyCopilotFab/);
    assert.equal((spa.match(/applyCopilotFab\(\)/g) || []).length >= 3, true);
    assert.match(spa, /ia:assist/);
    const dash = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(dash, /copilot-fab--hidden/);
    assert.match(dash, /Assistente da clínica/);
    const api = readFileSync(join(ROOT, "routes/copiloto.js"), "utf8");
    assert.match(api, /COMPLEXITY\.SIMPLE/);
    assert.match(api, /deveChamarModeloCopiloto/);
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(agenda, /avisarSemResponsavel/);
    assert.doesNotMatch(agenda, /titulo: "Agendamentos sem responsável"/);
  });
});
