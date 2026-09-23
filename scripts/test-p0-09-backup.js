/**
 * P0-9 — restore não apaga e não mistura org.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  sanitizeRawTableRows,
  filterNewById,
  financeFingerprint,
  agendaFingerprint,
  previewBackupUnico,
  confirmRestoreMessage,
} from "../js/utils/backup-restore.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("P0-9 backup restore", () => {
  it("não copia linha de outra clínica", () => {
    const { ready, skippedForeign } = sanitizeRawTableRows(
      [
        { id: "a", org_id: "org-1", nome: "ok" },
        { id: "b", org_id: "org-2", nome: "outra" },
        { id: "c", nome: "sem-org" },
      ],
      "org-1"
    );
    assert.equal(skippedForeign, 1);
    assert.equal(ready.length, 2);
    assert.ok(ready.every((r) => r.org_id === "org-1"));
  });

  it("pula id que já existe e nunca pede delete", () => {
    const { insert, skippedExisting } = filterNewById(
      [{ id: "1" }, { id: "2" }, { id: "3" }],
      ["1", "3"]
    );
    assert.equal(skippedExisting, 2);
    assert.deepEqual(insert.map((r) => r.id), ["2"]);
    const src = readFileSync(join(ROOT, "js/services/backup.service.js"), "utf8");
    assert.doesNotMatch(src, /\.delete\(/);
    assert.match(src, /filterNewById/);
  });

  it("mesmo lançamento e mesmo horário são o mesmo item", () => {
    assert.equal(
      financeFingerprint({ data: "2026-09-22", tipo: "entrada", valor: 100, descricao: "Sessão" }),
      financeFingerprint({ data: "2026-09-22T00:00:00", tipo: "entrada", valor: 100.0, descricao: "  Sessão  " })
    );
    assert.equal(
      agendaFingerprint({ data: "2026-09-22", hora: "14:00:00" }),
      agendaFingerprint({ data: "2026-09-22", hora: "14:00" })
    );
  });

  it("prévia e tela pedem confirmação sem apagar", () => {
    const p = previewBackupUnico({ clientes: [{}], financeiro: [{}, {}], agenda: [] });
    assert.equal(p.clientes, 1);
    assert.equal(p.financeiro, 2);
    assert.match(confirmRestoreMessage(p), /Nada é apagado/);
    const html = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(html, /Nada é apagado/);
    const lote = readFileSync(join(ROOT, "js/services/importacao-lote.service.js"), "utf8");
    assert.match(lote, /ignorados_duplicados/);
    assert.match(lote, /financeFingerprint/);
  });
});
