/**
 * Lote 85 — cobrança pelo app existe, mas só cobra com parceria.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGAMENTO_APP_ENABLED } from "../js/core/feature-flags.js";
import {
  TAXA_APP_POR_PARCELA_PCT,
  TAXA_MERCADO_POR_PARCELA_PCT,
  taxaPorParcelasPct,
  textoComparativoTaxa,
} from "../js/core/pagamento-regras.js";
import {
  JORNADA_COBRANCA,
  MSG_PARCERIA,
  montarCobranca,
  montarInteresse,
  parceriaPagamentoAtiva,
  recusarSemParceria,
} from "../js/utils/pagamento-app.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 85 cobrança pelo app em parceria", () => {
  it("flag continua desligada", () => {
    assert.equal(PAGAMENTO_APP_ENABLED, false);
    const flags = readFileSync(join(ROOT, "js/core/feature-flags.js"), "utf8");
    assert.match(flags, /PAGAMENTO_APP_ENABLED\s*=\s*false/);
  });

  it("sem chave da operadora não ativa", () => {
    assert.equal(parceriaPagamentoAtiva({}), false);
    assert.equal(parceriaPagamentoAtiva({ PAGAMENTO_APP_ENABLED: "true" }), false);
    assert.equal(
      parceriaPagamentoAtiva({ PAGAMENTO_APP_ENABLED: "true", PAGAMENTO_PARCEIRO_KEY: "curta" }),
      false
    );
    assert.equal(
      parceriaPagamentoAtiva({ PAGAMENTO_APP_ENABLED: "true", PAGAMENTO_PARCEIRO_KEY: "parceiro-ok" }),
      true
    );
    assert.equal(recusarSemParceria({}), MSG_PARCERIA);
    assert.match(MSG_PARCERIA, /parceria/i);
  });

  it("montar cobrança usa o valor informado, não inventa preço", () => {
    assert.throws(() => montarCobranca({ valor: 0 }), /não inventa o preço/i);
    const c = montarCobranca({ valor: 350, metodo: "pix" });
    assert.equal(c.valor, 350);
    assert.equal(c.metodo, "pix");
    assert.equal(c.parcelas, 1);
    const cr = montarCobranca({ valor: 1200, metodo: "credito", parcelas: 6 }, 12);
    assert.equal(cr.parcelas, 6);
  });

  it("jornada tem 4 passos e interesse não cobra", () => {
    assert.equal(JORNADA_COBRANCA.length, 4);
    assert.ok(JORNADA_COBRANCA.some((p) => /maquininha/i.test(p.titulo)));
    assert.ok(JORNADA_COBRANCA.some((p) => /caixa/i.test(p.titulo)));
    assert.equal(TAXA_MERCADO_POR_PARCELA_PCT, 1);
    assert.ok(TAXA_APP_POR_PARCELA_PCT < TAXA_MERCADO_POR_PARCELA_PCT);
    assert.equal(taxaPorParcelasPct(3, TAXA_MERCADO_POR_PARCELA_PCT), 3);
    assert.ok(taxaPorParcelasPct(3, TAXA_APP_POR_PARCELA_PCT) < 3);
    assert.match(textoComparativoTaxa(3), /menor/i);
    const i = montarInteresse({ volume_mensal: 50000, recado: "já tenho maquininha" });
    assert.equal(i.status, "interesse");
    assert.equal(i.volume_mensal, 50000);
    assert.doesNotMatch(JSON.stringify(i), /cobrar|charge/i);
  });

  it("API, SQL e tela recusam sozinhas; caixa permanece o caminho atual", () => {
    const route = readFileSync(join(ROOT, "routes/pagamento-app.js"), "utf8");
    assert.match(route, /recusarSemParceria/);
    assert.doesNotMatch(route, /openai/i);
    const sql = readFileSync(join(ROOT, "supabase/supabase-fase0-cobrancas-app-colar.sql"), "utf8");
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.cobrancas_app/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.pagamento_adesao/);
    assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
    const view = readFileSync(join(ROOT, "js/views/pagamento.views.js"), "utf8");
    assert.match(view, /Aguardando parceria/);
    assert.match(view, /Anotar interesse/);
    assert.match(view, /TAXA_MERCADO_POR_PARCELA_PCT/);
    assert.match(view, /maquininha/i);
    assert.match(route, /acao === "interesse"/);
    const srv = readFileSync(join(ROOT, "js/services/pagamento-app.service.js"), "utf8");
    assert.match(srv, /PARCERIA/);
    assert.match(srv, /createLancamento/);
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.doesNotMatch(agenda, /PAGAMENTO_APP_ENABLED\s*=\s*true/);
  });
});
