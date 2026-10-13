/**
 * Home após login+org = Dashboard (cockpit). Agenda continua navegável.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatCpf, formatPhone } from "../js/utils/input-masks.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("home pós-autenticação", () => {
  it("com organização o bootstrap vai para dashboard, não para agenda", () => {
    const boot = readFileSync(join(ROOT, "js/core/bootstrap.js"), "utf8");
    assert.match(boot, /return \{ next: "dashboard" \}/);
    assert.doesNotMatch(boot, /return \{ next: "agenda" \}/);
    assert.match(boot, /pickActiveOrg/);
    assert.match(boot, /countClients/);
    assert.match(boot, /\.from\("clients"\)/);

  });

  it("conta nova sem org vai para onboarding e não cai se o convite falhar", () => {
    const boot = readFileSync(join(ROOT, "js/core/bootstrap.js"), "utf8");
    assert.match(boot, /clearActiveOrg\(\)/);
    assert.match(boot, /return \{ next: "onboarding" \}/);
    assert.match(boot, /Convite indisponível/);
    const spa = readFileSync(join(ROOT, "js/core/spa.js"), "utf8");
    assert.match(spa, /route === "onboarding"/);
    assert.match(spa, /redirect\("\/onboarding\.html"\)/);
    const callback = readFileSync(join(ROOT, "js/views/auth-callback.views.js"), "utf8");
    assert.match(callback, /bootstrapAfterLogin/);
    assert.match(callback, /onboarding\.html/);
  });

  it("Fase 0: um caminho para criar clínica e RPC create_clinic", () => {
    const org = readFileSync(join(ROOT, "js/core/org.js"), "utf8");
    assert.match(org, /rpc\("create_clinic"/);
    assert.match(org, /isMissingCreateClinicRpc/);
    const sql = readFileSync(join(ROOT, "supabase/migrations/20261008120000_fase0_create_clinic.sql"), "utf8");
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.create_clinic/);
    assert.match(sql, /SECURITY DEFINER/);
    assert.match(sql, /membership insert owner or invitee/);
    assert.doesNotMatch(sql, /service_role/);
    const colar = readFileSync(join(ROOT, "supabase/supabase-fase0-criar-clinica-colar.sql"), "utf8");
    assert.match(colar, /create_clinic/);
    const onb = readFileSync(join(ROOT, "js/views/onboarding.views.js"), "utf8");
    assert.match(onb, /redirect\("\/onboarding\.html"\)/);
    const createOrg = readFileSync(join(ROOT, "create-org.html"), "utf8");
    assert.match(createOrg, /onboarding\.html/);
    const legacy = readFileSync(join(ROOT, "onboarding/index.html"), "utf8");
    assert.match(legacy, /onboarding\.html/);
    assert.doesNotMatch(legacy, /index\.html#onboarding/);
  });

  it("Agenda permanece rota explícita no SPA", () => {
    const spa = readFileSync(join(ROOT, "js/core/spa.js"), "utf8");
    assert.match(spa, /agenda:\s*\{/);
    assert.match(spa, /view: "agenda\.views\.js"/);
    assert.match(spa, /permission: "agenda:view"/);
    assert.match(spa, /dashboard:\s*\{/);
    assert.match(spa, /dashboard: "Hoje"/);
  });

  it("shell chama a home de Hoje; pacientes na raiz; sem rota nova", () => {
    const dash = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(dash, /data-view="dashboard"/);
    assert.match(dash, /sidebar-label">Hoje</);
    assert.match(dash, /data-view="clientes"/);
    assert.match(dash, /sidebar-label">Pacientes</);
    assert.match(dash, /id="btnGestao"/);
    assert.match(dash, /id="btnInteligencia"/);
    assert.match(dash, /data-view="copiloto"/);
    assert.doesNotMatch(dash, /id="cadastrarWrap"/);
    assert.doesNotMatch(dash, /data-view="atendimentos"/);
    const spa = readFileSync(join(ROOT, "js/core/spa.js"), "utf8");
    assert.doesNotMatch(spa, /atendimentos:\s*\{/);
  });

  it("lista de pacientes usa as rotas existentes e ações na linha", () => {
    const dash = readFileSync(join(ROOT, "dashboard.html"), "utf8");
    assert.match(dash, /id="view-clientes"/);
    assert.match(dash, /<h2>Pacientes<\/h2>/);
    assert.match(dash, /id="btnNovoCliente"/);
    const views = readFileSync(join(ROOT, "js/views/clientes.views.js"), "utf8");
    assert.match(views, /clientes-acao-ver/);
    assert.match(views, /clientes-acao-agendar/);
    assert.match(views, /agendaPrefillClientId/);
    assert.match(views, /wa\.me/);
    const perfil = readFileSync(join(ROOT, "js/views/cliente-perfil.views.js"), "utf8");
    assert.match(perfil, /data-tab="dados">Dados</);
    assert.match(perfil, /cliente-perfil-actions-main/);
  });

  it("CPF e telefone formatam com máscara desde o primeiro dígito", () => {
    assert.equal(formatCpf("12345678901"), "123.456.789-01");
    assert.equal(formatPhone("11987654321"), "(11) 98765-4321");
    const index = readFileSync(join(ROOT, "index.html"), "utf8");
    assert.match(index, /class="login-page"/);
    assert.match(index, /placeholder="000.000.000-00"/);
    assert.match(index, /for="cpf"/);
    const css = readFileSync(join(ROOT, "js/css/style.css"), "utf8");
    assert.match(css, /body\.login-page/);
    assert.match(css, /--sc-vv-offset/);
  });
});
