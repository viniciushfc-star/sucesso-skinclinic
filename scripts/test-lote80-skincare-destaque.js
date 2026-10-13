/**
 * Lote 80 — destaque de mercado na rotina só com fonte. Sem ranking.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  copyDestaque,
  htmlDestaquesMercado,
  isDestaqueFonteCompleta,
  payloadDestaquesParaIa,
} from "../js/utils/skincare-mercado.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const ok = {
  id: "d1",
  marca_produto: "ISDIN Fusion Water",
  porque: "filtro com publicação recente",
  fonte: "consenso da clínica n=6",
  data_ref: "2026-03-01",
  metodologia: "leitura de bula + 6 profissionais",
  confianca: "media",
  amostra: 6,
};

describe("Lote 80 destaque skincare com fonte", () => {
  it("sem fonte não entra; copy não diz o melhor do mercado", () => {
    assert.equal(isDestaqueFonteCompleta({ ...ok, fonte: "" }), false);
    assert.equal(isDestaqueFonteCompleta(ok), true);
    const t = copyDestaque(ok);
    assert.match(t, /em evidência segundo/);
    assert.doesNotMatch(t, /melhor do mercado/i);
    assert.equal(payloadDestaquesParaIa([{ ...ok, fonte: "" }]).length, 0);
    assert.equal(payloadDestaquesParaIa([ok])[0].fonte, ok.fonte);
    assert.match(htmlDestaquesMercado([ok]), /data-destaque-id/);
    assert.match(htmlDestaquesMercado([], { sqlAusente: true }), /supabase-fase0-skincare-mercado-colar/);
  });

  it("Skincare lista e envia destaques; rota prioriza casa", () => {
    const view = readFileSync(join(ROOT, "js/views/skincare.views.js"), "utf8");
    assert.match(view, /destaques_mercado/);
    assert.match(view, /bindDestaquesMercado/);
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(html, /id="skincareDestaqueForm"/);
    assert.match(html, /O que o mercado destaca/);
    const rota = readFileSync(join(ROOT, "routes/skincare.js"), "utf8");
    assert.match(rota, /payloadDestaquesParaIa/);
    assert.match(rota, /NÃO substituem a casa/);
    assert.match(rota, /evidencias/);
    assert.doesNotMatch(rota, /sendWhatsapp/);
  });
});
