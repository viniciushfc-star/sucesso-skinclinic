/**
 * Lote 16 — confirmação: 2ª tentativa só no clique, se não respondeu.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { origemLembreteWhatsapp, rotuloLembrete } from "../js/utils/confirmacao-tentativa.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("segunda tentativa de confirmação", () => {
  it("1ª, 2ª se não respondeu, some se já confirmou", () => {
    assert.equal(rotuloLembrete({}).n, 1);
    assert.equal(rotuloLembrete({ reminder_sent_at: "2026-09-26" }).n, 2);
    assert.equal(rotuloLembrete({ reminder_sent_at: "2026-09-26", confirmed_at: "2026-09-26" }).enviar, false);
    assert.equal(origemLembreteWhatsapp(2), "agenda_lembrete_2");
    assert.equal(origemLembreteWhatsapp(1), "agenda_lembrete");
  });

  it("agenda rotula 2ª e não envia sozinha no cancelamento", () => {
    const src = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(src, /htmlAcoesLembrete/);
    assert.match(src, /origemLembreteWhatsapp/);
    assert.match(src, /Segunda tentativa/);
    assert.match(src, /btn-lembrete/);
  });
});
