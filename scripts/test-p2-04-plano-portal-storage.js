/**
 * P2-4 — plano na agenda, RPC portal por hash, storage com prefixo de org.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  addCalendarDays,
  buildPlanoAgendaSlots,
  expandPlanoSessoes,
} from "../js/utils/plano-agenda.js";
import { rejectsForeignOrgStoragePath } from "../js/core/storage-path.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(
  join(root, "supabase/migrations/20260922010000_p2_plano_agenda_portal_storage.sql"),
  "utf8"
);
const agendaSrc = readFileSync(join(root, "js/views/agenda.views.js"), "utf8");

describe("P2-4 plano na agenda", () => {
  it("quantidade vira sessões na ordem", () => {
    const procs = new Map([["p1", { name: "Limpeza", duration_minutes: 50 }]]);
    const sessoes = expandPlanoSessoes(
      [
        { procedure_id: "p1", ordem: 0, quantidade: 2 },
        { procedure_id: "p1", ordem: 1, quantidade: 1 },
      ],
      procs
    );
    assert.equal(sessoes.length, 3);
    assert.equal(sessoes[0].duration_minutes, 50);
  });

  it("demais sessões caem a cada 7 dias; onlyFirst não ocupa o calendário inteiro", () => {
    const sessoes = [
      { procedimento: "A", duration_minutes: 60 },
      { procedimento: "B", duration_minutes: 40 },
    ];
    const all = buildPlanoAgendaSlots({
      startDate: "2026-09-21",
      startTime: "10:00",
      sessoes,
    });
    assert.equal(all[1].data, addCalendarDays("2026-09-21", 7));
    assert.equal(all[1].sessao_plano, 2);
    const first = buildPlanoAgendaSlots({
      startDate: "2026-09-21",
      startTime: "10:00",
      sessoes,
      onlyFirst: true,
    });
    assert.equal(first.length, 1);
    assert.equal(first[0].sessoes_plano, 2);
  });

  it("modal da agenda oferece plano e não dispara WhatsApp", () => {
    assert.match(agendaSrc, /agendaPlano/);
    assert.match(agendaSrc, /buildPlanoAgendaSlots/);
    assert.doesNotMatch(agendaSrc, /sendWhatsapp\(fila/);
  });
});

describe("P2-4 RPC portal e storage", () => {
  it("RPC usa p_token e hash, não SETOF analise_pele", () => {
    assert.match(sql, /get_client_session_by_token\(p_token text\)/);
    assert.match(sql, /token_hash = v_hash/);
    assert.match(sql, /get_analises_pele_by_token\(p_token text\)/);
    assert.match(sql, /Sem ia_preliminar/);
    assert.doesNotMatch(sql, /a\.ia_preliminar/);
    assert.doesNotMatch(sql, /SETOF\s+analise_pele/i);
  });

  it("policies de storage exigem prefixo org_id", () => {
    assert.match(sql, /split_part\(name, '\/', 1\)/);
    assert.match(sql, /analise-pele-fotos/);
    assert.match(sql, /client-photos/);
    assert.match(sql, /SET public = false/);
  });

  it("path de outra org é recusado no cliente", () => {
    const org = "11111111-1111-1111-1111-111111111111";
    const other = "22222222-2222-2222-2222-222222222222";
    assert.equal(rejectsForeignOrgStoragePath(`${other}/c/x.jpg`, org), true);
    assert.equal(rejectsForeignOrgStoragePath(`${org}/c/x.jpg`, org), false);
    assert.equal(rejectsForeignOrgStoragePath("arquivo-legado.jpg", org), false);
  });
});
