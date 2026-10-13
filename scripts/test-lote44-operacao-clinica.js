import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOWED_INVITE_ROLES } from "../js/core/permissions.map.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("operação clínica (estoque, equipe, agenda, crm)", () => {
  it("SQL do plantel usa SECURITY DEFINER e não fica só no próprio user_id", () => {
    const sql = readFileSync(join(ROOT, "supabase/supabase-equipe-agenda-membros-colar.sql"), "utf8");
    assert.match(sql, /org_ids_of_uid/);
    assert.match(sql, /SECURITY DEFINER/);
    assert.match(sql, /org members read roster/);
  });

  it("convite permite administrador só na lista; serviço exige quem convida", () => {
    assert.equal(ALLOWED_INVITE_ROLES.includes("master"), true);
    const inv = readFileSync(join(ROOT, "js/services/invite.service.js"), "utf8");
    assert.match(inv, /inviterRole !== "master"/);
    const team = readFileSync(join(ROOT, "js/views/team.views.js"), "utf8");
    assert.match(team, /value="master"/);
    assert.match(team, /showManageMode = role === "master" \|\| role === "gestor"/);
  });

  it("estoque sobe foto no client-photos e agenda cadastra paciente no horário", () => {
    const est = readFileSync(join(ROOT, "js/services/estoque-produtos.service.js"), "utf8");
    assert.match(est, /client-photos/);
    const agenda = readFileSync(join(ROOT, "js/views/agenda.views.js"), "utf8");
    assert.match(agenda, /btnAgendaNovoPaciente/);
    assert.match(agenda, /createClient/);
    assert.match(agenda, /agendaPanelBtnOrcamento/);
  });

  it("vender pacote, CRM recolhido, anamnese com Mais, comparativo compacto", () => {
    const perfil = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(perfil, /btnVenderPacote/);
    assert.match(perfil, /createPacote/);
    const dash = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(dash, /crmMaisDetalhes/);
    assert.match(dash, /anamneseMaisSelect/);
    const css = readFileSync(join(ROOT, "js/css/style.css"), "utf8");
    assert.match(css, /modal-card--compare/);
  });
});
