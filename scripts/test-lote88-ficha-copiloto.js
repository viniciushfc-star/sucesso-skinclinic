/**
 * Lote 88 — Copiloto explica a ficha. Humano clica. Sem preço, sem WhatsApp, sem gravar.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { contextoFichaCopiloto } from "../js/utils/ficha-copiloto.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 88 copiloto na ficha", () => {
  it("contexto descreve o ciclo e recusa decidir", () => {
    const ctx = contextoFichaCopiloto({
      nome: "Ana",
      proxima: "Registrar o que foi aplicado",
      combinado: "Oleosidade",
      receita: "Limpeza profunda",
      feito: "Limpeza profunda",
      avisoMaterial: true,
    });
    assert.equal(ctx.origem, "ficha");
    assert.match(ctx.titulo, /Ana/);
    assert.match(ctx.mensagem, /Próximo passo humano/);
    assert.match(ctx.mensagem, /Combinado: Oleosidade/);
    assert.match(ctx.mensagem, /sem produto/);
    assert.match(ctx.mensagem, /Não grave preço/);
    assert.doesNotMatch(ctx.mensagem, /WhatsApp sai/i);
  });

  it("ficha tem botão; painel e API usam origem ficha", () => {
    const view = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(view, /btn-ficha-explicar/);
    assert.match(view, /Explicar esta ficha/);
    assert.match(view, /ia:copilot/);
    assert.match(view, /ia:assist/);
    assert.match(view, /contextoFichaCopiloto/);
    assert.match(view, /__scOpenCopilot/);
    assert.doesNotMatch(view, /view-atendimentos|#atendimentos/);
    const notif = readFileSync(join(ROOT, "js/views/notificacoes.views.js"), "utf8");
    assert.match(notif, /__scOpenCopilot = openCopilotPanel/);
    assert.match(notif, /Contexto desta ficha/);
    assert.match(notif, /origem: _copilotContext\.origem/);
    const api = readFileSync(join(ROOT, "routes/copiloto.js"), "utf8");
    assert.match(api, /CONTEXTO DA FICHA/);
    assert.match(api, /origemFicha/);
    assert.match(api, /deveChamarModeloCopiloto/);
  });
});
