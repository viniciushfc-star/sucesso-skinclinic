/**
 * P2-6 — Minha jornada no portal, só o validado.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPortalJornada, jornadaJsonProibido } from "../js/utils/portal-jornada.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("P2-6 portal jornada", () => {
  it("pele pendente não leva texto validado nem ia_preliminar", () => {
    const steps = buildPortalJornada({
      today: "2026-09-21",
      analises: [{ status: "pending_validation", texto_validado: null, ia_preliminar: "SEGREDO" }],
    });
    const pele = steps.find((s) => s.id === "pele");
    assert.equal(pele.estado, "aguardando");
    assert.equal(jornadaJsonProibido(steps), false);
    assert.doesNotMatch(pele.detalhe, /SEGREDO/);
  });

  it("pele validada e próxima sessão viram próximo passo", () => {
    const steps = buildPortalJornada({
      today: "2026-09-21",
      cadastroCompleto: true,
      analises: [{ status: "validated", texto_validado: "ok clinico" }],
      sessoes: [{ data: "2026-09-28", hora: "10:00:00", procedimento: "Limpeza" }],
    });
    assert.equal(steps.find((s) => s.id === "pele").estado, "feito");
    assert.match(steps.find((s) => s.id === "proximo").detalhe, /2026-09-28/);
  });

  it("skincare só entra se a clínica liberou", () => {
    const sem = buildPortalJornada({ today: "2026-09-21" });
    const com = buildPortalJornada({ today: "2026-09-21", hasSkincare: true });
    assert.equal(sem.some((s) => s.id === "skincare"), false);
    assert.equal(com.some((s) => s.id === "skincare"), true);
  });

  it("SQL e dashboard não expõem ia_preliminar", () => {
    const sql = readFileSync(join(root, "supabase/migrations/20260922020000_p2_portal_jornada.sql"), "utf8");
    const dash = readFileSync(join(root, "js/Client/dashboard.client.js"), "utf8");
    assert.match(sql, /list_portal_jornada_agenda/);
    assert.doesNotMatch(sql, /ia_preliminar/);
    assert.match(dash, /Minha jornada/);
    assert.doesNotMatch(dash, /ia_preliminar/);
  });

  it("plano e orientações entram sem rascunho de IA", () => {
    const steps = buildPortalJornada({
      today: "2026-09-21",
      cadastroCompleto: true,
      protocol: { name: "Protocolo laser", ia_preliminar: "SEGREDO" },
      records: [{ content: "hidratacao" }],
    });
    assert.equal(steps.find((s) => s.id === "plano").detalhe, "Protocolo laser");
    assert.equal(steps.find((s) => s.id === "tratamentos").estado, "feito");
    assert.equal(jornadaJsonProibido(steps), false);
    const semHorario = buildPortalJornada({
      today: "2026-09-21",
      cadastroCompleto: true,
      anamneses: [{ id: 1 }],
    });
    assert.match(semHorario.find((s) => s.id === "proximo").detalhe, /marcar o próximo horário/);
  });
});
