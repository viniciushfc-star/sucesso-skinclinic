/**
 * Lote 19 — anamnese versionada: não apaga a ficha anterior.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  mapaVersaoAnamnese,
  rotuloVersaoAnamnese,
  ehDuplicataDaUltima,
} from "../js/utils/anamnese-versao.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("versão de anamnese", () => {
  it("numera do mais antigo ao mais novo e detecta duplicata", () => {
    const map = mapaVersaoAnamnese([
      { id: "b", funcao_id: "f1", created_at: "2026-09-20T12:00:00Z" },
      { id: "a", funcao_id: "f1", created_at: "2026-09-10T12:00:00Z" },
    ]);
    assert.equal(map.a.n, 1);
    assert.equal(map.b.n, 2);
    assert.equal(map.b.total, 2);
    assert.equal(rotuloVersaoAnamnese(map.b), "Versão 2 de 2");
    const ultima = { ficha: { queixa: "acne" }, conteudo: "", conduta_tratamento: "" };
    assert.equal(ehDuplicataDaUltima({ ficha: { queixa: "acne" }, conteudo: "", conduta: "", fotosCount: 0, ultima }), true);
    assert.equal(ehDuplicataDaUltima({ ficha: { queixa: "melasma" }, conteudo: "", conduta: "", fotosCount: 0, ultima }), false);
    assert.equal(ehDuplicataDaUltima({ ficha: { queixa: "acne" }, fotosCount: 1, ultima }), false);
  });

  it("salvar cria registro novo e não atualiza a ficha antiga", () => {
    const view = readFileSync(join(ROOT, "js/views/anamnese.views.js"), "utf8");
    assert.match(view, /ehDuplicataDaUltima/);
    assert.match(view, /createRegistro/);
    assert.match(view, /As anteriores continuam/);
    const svc = readFileSync(join(ROOT, "js/services/anamnesis.service.js"), "utf8");
    assert.match(svc, /Cria um novo registro evolutivo/);
    assert.doesNotMatch(svc, /\.update\(\{[\s\S]*ficha:/);
  });
});
