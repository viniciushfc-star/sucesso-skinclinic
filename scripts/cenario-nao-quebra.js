/**
 * Como cada pessoa abrindo as telas: login JWT + leituras que o SPA faria.
 * Não grava, não WhatsApp em massa, não chama IA cara.
 *
 *   node scripts/cenario-nao-quebra.js
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { escolherOrgComPacientes } from "../js/utils/golden-flow-auth.js";
import { permissionAllowedByRoleForTest } from "../lib/api-auth.js";
import { telasDoPapel } from "../js/utils/cenario-papeis.js";

const BASE = String(process.env.QA_LOCAL_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const ROLES = ["master", "gestor", "recepcao", "profissional", "funcionario"];

const TELAS_TABELAS = {
  dashboard: ["agenda", "clients"],
  agenda: ["agenda", "salas"],
  clientes: ["clients"],
  crm: ["agenda_waitlist"],
  financeiro: ["financeiro"],
  estoque: ["estoque_produtos", "estoque_entradas"],
  procedimento: ["procedures"],
  skincare: ["skincare_rotinas", "skincare_mercado_refs"],
  planos: ["planos_terapeuticos"],
  protocolo: ["protocolos_aplicados"],
  team: ["organization_users"],
};

function missingTable(err) {
  return /does not exist|schema cache|PGRST205/i.test(String(err?.message || err?.code || ""));
}

async function loginRole(role) {
  const email = String(process.env[`QA_EMAIL_${role.toUpperCase()}`] || "").trim();
  const password = String(
    process.env[`QA_PASS_${role.toUpperCase()}`] || process.env.QA_PASS_MASTER || ""
  ).trim();
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!email || !password || !url || !anon) return { ok: false, pulou: true, detalhe: "sem credencial" };
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data?.session) return { ok: false, detalhe: error?.message || "login falhou" };
  const org = await escolherOrgComPacientes(sb, data.user.id);
  return { ok: true, sb, token: data.session.access_token, org, userId: data.user.id, email };
}

async function hit(path, { token, method = "GET", json } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) headers["Content-Type"] = "application/json";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: json !== undefined ? JSON.stringify(json) : undefined,
      signal: ctrl.signal,
      redirect: "manual",
    });
    const text = await res.text().catch(() => "");
    return { status: res.status, text: text.slice(0, 160) };
  } finally {
    clearTimeout(t);
  }
}

export async function runNaoQuebra() {
  const passos = [];
  const mark = (id, estado, detalhe) => passos.push({ id, estado, detalhe });

  for (const page of ["/dashboard.html", "/portal.html", "/agendar.html", "/index.html", "/api/health"]) {
    try {
      const r = await hit(page);
      const quebrou = r.status >= 500;
      mark(`page${page}`, quebrou ? "FALHOU" : "OK", `${r.status}`);
    } catch (e) {
      mark(`page${page}`, "FALHOU", String(e.message || e).slice(0, 120));
    }
  }

  const rpcAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: rpcErr } = await rpcAnon.rpc("get_client_by_token", { p_token: "token-lixo-piloto" });
  mark(
    "cliente-portal-token-lixo",
    /ia_preliminar/i.test(String(rpcErr?.message || "")) ? "FALHOU" : "OK",
    rpcErr ? String(rpcErr.message).slice(0, 100) : "RPC sem erro (inesperado para token lixo)"
  );

  for (const role of ROLES) {
    const login = await loginRole(role);
    if (!login.ok) {
      mark(`${role}-login`, login.pulou ? "PULOU" : "FALHOU", login.detalhe);
      continue;
    }
    const roleLive = login.org.ok ? login.org.role : "?";
    const orgId = login.org.ok ? login.org.orgId : null;
    mark(`${role}-login`, login.org.ok ? "OK" : "FALHOU", `role=${roleLive} org=${login.org.ok ? "sim" : login.org.detalhe}`);
    if (!orgId) continue;

    const telas = telasDoPapel(roleLive);
    mark(`${role}-menu`, "OK", `ver ${telas.join(",") || "(vazio)"}`);

    const tabelas = [...new Set(telas.flatMap((v) => TELAS_TABELAS[v] || []))];
    if (!tabelas.length) {
      tabelas.push("clients", "agenda");
    }
    for (const table of tabelas) {
      const { error, count } = await login.sb.from(table).select("id", { count: "exact", head: true }).eq("org_id", orgId);
      if (error) {
        mark(
          `${role}-tela-${table}`,
          missingTable(error) ? "OK" : "FALHOU",
          missingTable(error) ? `${table} ausente (tela aguenta)` : String(error.message).slice(0, 140)
        );
      } else {
        mark(`${role}-tela-${table}`, "OK", `${table} n=${count ?? 0}`);
      }
    }

    const dash = await hit("/dashboard.html", { token: login.token });
    mark(`${role}-dashboard-html`, dash.status < 500 ? "OK" : "FALHOU", `GET ${dash.status}`);

    const cop = await hit("/api/copiloto", {
      token: login.token,
      method: "POST",
      json: { org_id: orgId, messages: [] },
    });
    const denyIa = !permissionAllowedByRoleForTest(roleLive, "ia:copilot");
    const copOk = denyIa ? cop.status === 401 || cop.status === 403 : cop.status < 500;
    mark(`${role}-copiloto`, copOk ? "OK" : "FALHOU", `copiloto ${cop.status} (deny=${denyIa})`);

    const ops = await hit("/api/ops-summary", {
      token: login.token,
      method: "POST",
      json: { org_id: orgId },
    });
    const denyFin = !permissionAllowedByRoleForTest(roleLive, "financeiro:view") && !permissionAllowedByRoleForTest(roleLive, "auditoria:view");
    const opsOk = denyFin ? ops.status === 401 || ops.status === 403 || ops.status === 404 : ops.status < 500;
    mark(`${role}-contador-api`, opsOk ? "OK" : "FALHOU", `ops-summary ${ops.status}`);
  }

  const falhou = passos.filter((p) => p.estado === "FALHOU" || p.estado === "TRAVOU");
  return { ok: falhou.length === 0, passos, falhou };
}

function print(r) {
  console.log("CENARIO-NAO-QUEBRA (como cada usuário abrindo a tela)");
  for (const p of r.passos) {
    if (p.estado === "OK" && !process.argv.includes("--all")) continue;
    console.log(`${p.estado.padEnd(7)} ${p.id} — ${p.detalhe}`);
  }
  const nOk = r.passos.filter((p) => p.estado === "OK").length;
  const nFail = r.falhou.length;
  const nSkip = r.passos.filter((p) => p.estado === "PULOU").length;
  console.log(`resumo ${nOk} ok · ${nFail} quebrou · ${nSkip} pulou`);
  if (r.falhou.length) {
    console.log("QUEBROU:");
    for (const p of r.falhou) console.log(`  ${p.id} — ${p.detalhe}`);
  }
  console.log(r.ok ? "OK" : "FALHOU");
}

const invoked = String(process.argv[1] || "").replace(/\\/g, "/").endsWith("cenario-nao-quebra.js");
if (invoked) {
  runNaoQuebra()
    .then((r) => {
      print(r);
      process.exit(r.ok ? 0 : 1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
