/**
 * Lote 8 — agenda de profissionais esporádicos: ocupado sem PII,
 * deslocamento, jornada saudável, clínica ocupa o Google.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_TRAVEL_MINUTES,
  conflitoExternoComDeslocamento,
  avaliarJornadaClinica,
  busyMenosAgendaClinica,
  labelOcupadoPessoal,
} from "../js/utils/agenda-ocupacao.js";
import { buildClinicBusyEvent, connectionNeedsReconnect } from "../lib/google-calendar.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Lote 8 agenda esporádico / Google", () => {
  it("deslocamento impede agendar colado no compromisso pessoal", () => {
    const slotStart = new Date("2026-09-23T17:00:00.000Z");
    const slotEnd = new Date("2026-09-23T18:00:00.000Z");
    const blocks = [{ start_at: "2026-09-23T16:30:00.000Z", end_at: "2026-09-23T16:50:00.000Z" }];
    const hit = conflitoExternoComDeslocamento(slotStart, slotEnd, blocks, 40);
    assert.ok(hit);
    assert.equal(hit.procedimento, labelOcupadoPessoal());
    assert.match(hit.motivo, /chegar/);
    assert.equal(DEFAULT_TRAVEL_MINUTES, 40);
  });

  it("jornada longa ou sequência sem pausa é recusada", () => {
    const day = [];
    for (let h = 8; h < 17; h++) {
      day.push({
        start: new Date(`2026-09-23T${String(h).padStart(2, "0")}:00:00`),
        end: new Date(`2026-09-23T${String(h).padStart(2, "0")}:50:00`),
      });
    }
    const longa = avaliarJornadaClinica(day);
    assert.equal(longa.ok, false);
    const seq = avaliarJornadaClinica([
      { start: new Date("2026-09-23T08:00:00"), end: new Date("2026-09-23T12:30:00") },
    ]);
    assert.equal(seq.ok, false);
    const ok = avaliarJornadaClinica([
      { start: new Date("2026-09-23T09:00:00"), end: new Date("2026-09-23T10:00:00") },
      { start: new Date("2026-09-23T14:00:00"), end: new Date("2026-09-23T15:00:00") },
    ]);
    assert.equal(ok.ok, true);
  });

  it("ocupação da clínica no Google não vira bloco pessoal", () => {
    const busy = [
      { start: "2026-09-23T14:00:00.000Z", end: "2026-09-23T15:00:00.000Z" },
      { start: "2026-09-23T10:00:00.000Z", end: "2026-09-23T11:00:00.000Z" },
    ];
    const clinic = [{ start: "2026-09-23T14:00:00.000Z", end: "2026-09-23T15:00:00.000Z" }];
    const out = busyMenosAgendaClinica(busy, clinic);
    assert.equal(out.length, 1);
    assert.match(out[0].start, /10:00/);
  });

  it("evento escrito no Google não leva paciente", () => {
    const ev = buildClinicBusyEvent({
      date: "2026-09-23",
      hora: "14:30",
      durationMinutes: 60,
      agendaId: "aaa",
    });
    assert.equal(ev.summary, "Atendimento na clínica");
    assert.doesNotMatch(JSON.stringify(ev), /paciente|cliente|phone|cpf/i);
    assert.equal(ev.visibility, "private");
    assert.equal(ev.extendedProperties.private.skinclinic, "1");
  });

  it("sync usa FreeBusy; occupy existe; UI não pede título do Google", () => {
    const sync = readFileSync(join(ROOT, "routes/google-calendar/sync.js"), "utf8");
    const occupy = readFileSync(join(ROOT, "routes/google-calendar/occupy.js"), "utf8");
    const auth = readFileSync(join(ROOT, "routes/google-calendar/auth.js"), "utf8");
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    const svc = readFileSync(join(ROOT, "js/services/appointments.service.js"), "utf8");
    const lib = readFileSync(join(ROOT, "lib/google-calendar.js"), "utf8");
    assert.match(sync, /fetchFreeBusy/);
    assert.doesNotMatch(sync, /summary/);
    assert.match(occupy, /Atendimento na clínica|buildClinicBusyEvent/);
    assert.match(lib, /calendar.freebusy/);
    assert.match(auth, /GOOGLE_CALENDAR_SCOPES/);
    assert.match(agenda, /listExternalBlocksForRange/);
    assert.match(agenda, /occupyProfessionalCalendar/);
    assert.match(agenda, /needs_reconnect/);
    assert.match(svc, /conflitoExternoComDeslocamento/);
    assert.match(svc, /avaliarJornadaClinica/);
    const status = readFileSync(join(ROOT, "routes/google-calendar/status.js"), "utf8");
    assert.match(status, /connectionNeedsReconnect/);
    const team = readFileSync(join(ROOT, "js/views/team.views.js"), "utf8");
    assert.match(team, /Reconectar Google/);
  });

  it("conexão antiga pede reconectar; com os dois escopos não pede", () => {
    assert.equal(connectionNeedsReconnect({}), true);
    assert.equal(connectionNeedsReconnect({ granted_scopes: "https://www.googleapis.com/auth/calendar.readonly" }), true);
    assert.equal(
      connectionNeedsReconnect({
        granted_scopes:
          "https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events",
      }),
      false
    );
    assert.equal(
      connectionNeedsReconnect({
        granted_scopes:
          "https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events",
        reconnect_needed: true,
      }),
      true
    );
  });
});
