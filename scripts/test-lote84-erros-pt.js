/**
 * Lote 84 — erros em português, nunca só o número HTTP.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { userFacingError } from "../js/core/errors.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function assertPt(msg) {
  assert.ok(msg && msg.length > 12, msg);
  assert.doesNotMatch(msg, /^(?:HTTP\s*)?\d{3}$/);
  assert.match(msg, /[áàãâéêíóôõúçÁÀÃÂÉÊÍÓÔÕÚÇ]|perfil|sessão|sessao|banco|servidor|pedido|conexão|conexao|tabela|permissão|permissao|e-mail|senha|falha|tentativas|instantes/i);
}

describe("Lote 84 erros em português", () => {
  it("403, 401, 404, 429, 500 não aparecem só como número", () => {
    for (const n of [400, 401, 403, 404, 429, 500, 502, 503]) {
      assertPt(userFacingError(String(n)));
      assertPt(userFacingError({ status: n, message: String(n) }));
      assertPt(userFacingError({ message: `HTTP ${n}` }));
      assert.doesNotMatch(userFacingError({ status: n }), new RegExp(`^${n}$`));
    }
  });

  it("PGRST, JWT e RLS viram texto da clínica", () => {
    assertPt(userFacingError({ code: "42501", message: "permission denied" }));
    assertPt(userFacingError({ code: "PGRST116" }));
    assertPt(userFacingError({ message: "PGRST205" }));
    assertPt(userFacingError({ message: "JWT expired" }));
    assertPt(userFacingError({ message: "Forbidden" }));
    assert.match(userFacingError({ code: "email_exists" }), /e-mail já tem conta/i);
  });

  it("texto já em português segue igual", () => {
    const ok = "Horário salvo na agenda.";
    assert.equal(userFacingError(ok), ok);
  });

  it("toast e api-fetch passam pelo tradutor", () => {
    const toast = readFileSync(join(ROOT, "js/ui/toast.js"), "utf8");
    assert.match(toast, /userFacingError/);
    const api = readFileSync(join(ROOT, "js/core/api-fetch.js"), "utf8");
    assert.match(api, /mensagemDeRespostaHttp/);
    assert.match(api, /falhaApi/);
    const cop = readFileSync(join(ROOT, "js/services/copiloto.service.js"), "utf8");
    assert.match(cop, /userFacingError/);
  });
});
