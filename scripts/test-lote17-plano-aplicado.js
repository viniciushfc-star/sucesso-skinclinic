/**
 * Lote 17 — plano/pacote vs protocolo aplicado, sem travar atendimento.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compararPlanoVsAplicado, nomesCompativeis } from "../js/utils/plano-vs-aplicado.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("plano vs aplicado", () => {
  it("sessão consumida sem registro aparece; nome parecido alinha", () => {
    assert.equal(nomesCompativeis("Laser CO2", "laser co2 face"), true);
    const gap = compararPlanoVsAplicado({
      pacotes: [{ nome_pacote: "Laser", procedure_name: "Laser", sessoes_utilizadas: 2 }],
      aplicados: [],
    });
    assert.equal(gap.temDivergencia, true);
    assert.equal(gap.linhas[0].tipo, "consumo_sem_aplicado");
    const ok = compararPlanoVsAplicado({
      pacotes: [{ nome_pacote: "Laser", procedure_name: "Laser", sessoes_utilizadas: 1 }],
      aplicados: [{ descricao: "Laser região malar", protocolos: { nome: "Laser" } }],
    });
    assert.equal(ok.temDivergencia, false);
  });

  it("aplicado fora do pacote pede justificativa na observação", () => {
    const d = compararPlanoVsAplicado({
      pacotes: [{ nome_pacote: "Limpeza", procedure_name: "Limpeza", sessoes_utilizadas: 0 }],
      aplicados: [{ descricao: "Peeling", observacao: "Troca combinada na hora", protocolos: { nome: "Peeling" } }],
    });
    assert.equal(d.temDivergencia, true);
    assert.equal(d.linhas[0].tipo, "aplicado_fora_do_plano");
    assert.match(d.linhas[0].justificativa, /Troca combinada/);
    const view = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(view, /compararPlanoVsAplicado/);
    assert.match(view, /atendimento não trava/);
    assert.doesNotMatch(view, /planos2|protocolos2/);
  });
});
