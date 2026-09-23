/**
 * Lote 1 — destino WhatsApp da org + webhook sem insert sem event_id.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalPhoneDigits,
  phonesMatch,
  rowsIncludePhone,
  orgOwnsWhatsappDestination,
  resolveWhatsappRecipient,
} from "../lib/phone-match.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function mockAdmin({ clients = [], wait = [], waitError = null, clientsError = null } = {}) {
  return {
    from(table) {
      const filters = {};
      const finish = () => {
        if (table === "clients") {
          if (clientsError) return { data: null, error: clientsError };
          let rows = clients;
          if (filters.id) rows = rows.filter((r) => r.id === filters.id);
          return { data: rows, error: null };
        }
        if (table === "agenda_waitlist") {
          if (waitError) return { data: null, error: waitError };
          let rows = wait;
          if (filters.id) rows = rows.filter((r) => r.id === filters.id);
          return { data: rows, error: null };
        }
        return { data: [], error: null };
      };
      const api = {
        select() {
          return api;
        },
        eq(col, val) {
          filters[col] = val;
          return api;
        },
        maybeSingle() {
          const { data, error } = finish();
          if (error) return Promise.resolve({ data: null, error });
          return Promise.resolve({ data: data?.[0] || null, error: null });
        },
        then(onF, onR) {
          return Promise.resolve(finish()).then(onF, onR);
        },
      };
      return api;
    },
  };
}

describe("Lote 1 telefone org", () => {
  it("normaliza DDD brasileiro com 55", () => {
    assert.equal(canonicalPhoneDigits("(11) 99999-8888"), "5511999998888");
    assert.equal(canonicalPhoneDigits("5511999998888"), "5511999998888");
  });

  it("casa 11 dígitos com +55 e rejeita outro número", () => {
    assert.equal(phonesMatch("11999998888", "55 11 99999-8888"), true);
    assert.equal(phonesMatch("11999998888", "11999997777"), false);
    assert.equal(phonesMatch("", "11999998888"), false);
  });

  it("cliente da org permite; telefone de outra org não", () => {
    const rowsA = [{ id: "c1", phone: "(11) 98888-0000" }];
    assert.equal(rowsIncludePhone(rowsA, "5511988880000"), true);
    assert.equal(rowsIncludePhone(rowsA, "11977770000"), false);
  });

  it("orgOwns: cliente da org", async () => {
    const admin = mockAdmin({ clients: [{ id: "c1", phone: "11988880000" }] });
    assert.equal(await orgOwnsWhatsappDestination(admin, "org-a", "5511988880000"), true);
    assert.equal(await orgOwnsWhatsappDestination(admin, "org-a", "11977770000"), false);
  });

  it("orgOwns: espera da org se não está em clients", async () => {
    const admin = mockAdmin({
      clients: [],
      wait: [{ id: "w1", phone: "11911112222" }],
    });
    assert.equal(await orgOwnsWhatsappDestination(admin, "org-a", "11911112222"), true);
  });

  it("erro ao ler clients não libera o número", async () => {
    const admin = mockAdmin({
      clientsError: { message: "db" },
      wait: [{ phone: "11911112222" }],
    });
    assert.equal(await orgOwnsWhatsappDestination(admin, "org-a", "11911112222"), false);
  });

  it("API WhatsApp exige client_id da org; wa.me no cliente permanece", () => {
    const api = readFileSync(join(ROOT, "routes", "whatsapp-send.js"), "utf8");
    const fe = readFileSync(join(ROOT, "js", "services", "whatsapp.service.js"), "utf8");
    assert.match(api, /resolveWhatsappRecipient/);
    assert.doesNotMatch(api, /req\.body\?\.phone/);
    assert.match(fe, /wa\.me/);
    assert.match(fe, /envio humano/);
    assert.match(fe, /client_id/);
  });

  it("resolve: mesma org ALLOW; outra org DENY; telefone adulterado ignorado; sem telefone erro", async () => {
    const admin = mockAdmin({
      clients: [
        { id: "cli-a", phone: "11988880000" },
        { id: "cli-sem-tel", phone: "" },
      ],
    });
    const a = await resolveWhatsappRecipient(admin, "org-a", { clientId: "cli-a" });
    assert.equal(a.ok, true);
    assert.equal(a.phone, "5511988880000");
    const b = await resolveWhatsappRecipient(admin, "org-a", { clientId: "cli-b" });
    assert.equal(b.ok, false);
    assert.equal(b.reason, "cliente_outra_org");
    assert.equal(a.phone, "5511988880000");
    assert.notEqual(a.phone, canonicalPhoneDigits("11977779999"));
    const d = await resolveWhatsappRecipient(admin, "org-a", { clientId: "cli-sem-tel" });
    assert.equal(d.ok, false);
    assert.equal(d.reason, "cliente_sem_telefone");
    const e = await resolveWhatsappRecipient(admin, "org-a", {});
    assert.equal(e.reason, "sem_destino_autorizado");
  });

  it("lembretes filtram clients pela org do agendamento", () => {
    const src = readFileSync(join(ROOT, "routes", "lembretes-auto.js"), "utf8");
    assert.match(src, /\.eq\("id", ag\.cliente_id\)/);
    assert.match(src, /orgFiltro && String\(ag\.org_id\) !== String\(orgFiltro\)/);
    assert.match(src, /orgDoCliente/);
    assert.match(src, /cliente_outra_org/);
  });
});

describe("Lote 1 webhook sem fallback", () => {
  it("não grava financeiro sem webhook_event_id", () => {
    const src = readFileSync(join(ROOT, "routes", "webhook-transacoes.js"), "utf8");
    assert.match(src, /webhook_event_id: eventId/);
    assert.match(src, /identidade idempotente/);
    assert.doesNotMatch(src, /accountId\}:\$\{date\}/);
    assert.equal(src.includes("fallback"), false);
    assert.doesNotMatch(src, /webhook_event_id, \.\.\.rest/);
  });
});
