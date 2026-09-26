import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { waitingMinutes, salaEsperaStatus } from "../js/utils/sala-espera.js";
import { agruparComissoes, comissaoDeReceita, previstoVsRealizado } from "../js/utils/comissao-apuracao.js";
import { SETUP_STEP_IDS, SETUP_STEP_MINUTES } from "../js/utils/golden-flow.js";
import { pontoStatus } from "../js/utils/injetaveis-mapas.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("sala de espera, comissão, injetáveis, primeiro dia", () => {
  it("minutos na espera param quando o atendimento começa", () => {
    const t0 = new Date("2026-09-25T12:00:00Z");
    const t1 = new Date("2026-09-25T12:18:00Z");
    const t2 = new Date("2026-09-25T12:40:00Z");
    assert.equal(waitingMinutes(t0.toISOString(), null, t1), 18);
    assert.equal(waitingMinutes(t0.toISOString(), t1.toISOString(), t2), 18);
    assert.equal(salaEsperaStatus({ arrived_at: t0.toISOString() }, t1).key, "sala");
    assert.equal(salaEsperaStatus({ arrived_at: t0.toISOString(), started_at: t1.toISOString() }, t2).key, "atendimento");
  });

  it("comissão é cálculo, não pagamento", () => {
    assert.equal(comissaoDeReceita(1000, 10), 100);
    const g = agruparComissoes([
      { userId: "a", receita: 200, pct: 10 },
      { userId: "a", receita: 100, pct: 10 },
      { userId: "b", receita: 50, pct: 0 },
    ]);
    assert.equal(g[0].userId, "a");
    assert.equal(g[0].comissao, 30);
    assert.equal(g[0].atendimentos, 2);
    const svc = readFileSync(join(ROOT, "js/services/comissoes.service.js"), "utf8");
    assert.doesNotMatch(svc, /whatsapp-send|insert.*financeiro/i);
    const pv = previstoVsRealizado({ valor: 400, valorRecebido: 250, pct: 10 });
    assert.equal(pv.aberto, 150);
    assert.equal(pv.emAberto, true);
    assert.equal(pv.comissaoPrevista, 40);
    assert.equal(pv.comissaoRealizada, 25);
    assert.equal(previstoVsRealizado({ valor: 400 }).emAberto, false);
    const g2 = agruparComissoes([{ userId: "a", receita: 250, receitaPrevista: 400, pct: 10 }]);
    assert.equal(g2[0].comissao, 25);
    assert.equal(g2[0].comissaoPrevista, 40);
    assert.equal(g2[0].aberto, 150);
    const fin = readFileSync(join(ROOT, "js/views/financeiro.views.js"), "utf8");
    assert.match(fin, /Comissão no recebido/);
    const ag = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(ag, /previstoVsRealizado/);
    assert.match(ag, /Não lança outra entrada sozinha/);
  });

  it("ponto antigo sem status conta como aplicado", () => {
    assert.equal(pontoStatus({}), "aplicado");
    assert.equal(pontoStatus({ status: "planejado" }), "planejado");
  });

  it("primeiro dia soma 20 minutos e o SQL da espera existe", () => {
    const soma = SETUP_STEP_IDS.reduce((n, id) => n + SETUP_STEP_MINUTES[id], 0);
    assert.equal(soma, 20);
    const sql = readFileSync(join(ROOT, "supabase/migrations/20260925220000_p1_sala_espera.sql"), "utf8");
    assert.match(sql, /arrived_at/);
    assert.match(sql, /started_at/);
    const dash = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(dash, /dashboardSalaEsperaList/);
    assert.match(dash, /data-tab="comissoes"/);
  });
});
