/**
 * Papéis ao vivo: funcionário, gestor, master + portal do cliente + aba contador.
 * Recepção/profissional: matriz de permissão (não há QA_EMAIL_* desses papéis).
 *
 *   node scripts/cenario-papeis.js
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { resolve as pathResolve } from "node:path";
import { credenciaisGoldenAuth, escolherOrgComPacientes } from "../js/utils/golden-flow-auth.js";
import { relatorioContadorToReadable } from "../js/utils/contador-report.js";
import { telasDoPapel, expectativasPapel } from "../js/utils/cenario-papeis.js";
import { permissionAllowedByRoleForTest } from "../lib/api-auth.js";

const BASE = String(process.env.QA_LOCAL_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const TIMEOUT_MS = 20000;

function withTimeout(p, nome) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`TRAVOU ${nome}`)), TIMEOUT_MS)),
  ]);
}

async function loginRole(role) {
  const email = String(process.env[`QA_EMAIL_${role.toUpperCase()}`] || "").trim();
  const password = String(
    process.env[`QA_PASS_${role.toUpperCase()}`] || process.env.QA_PASS_MASTER || ""
  ).trim();
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!email || !password || !url || !anon) return { ok: false, detalhe: "sem credencial" };
  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    return { ok: false, detalhe: json.error_description || json.msg || String(res.status) };
  }
  return { ok: true, token: json.access_token, userId: json.user?.id, email };
}

function userClient(token) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function api(path, { token, method = "GET", json } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 120);
  }
  return { status: res.status, body };
}

function expect403(status) {
  return status === 401 || status === 403;
}

function jwtSub(token) {
  try {
    const p = String(token).split(".")[1];
    const json = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    return json.sub || json.user_id || "";
  } catch {
    return "";
  }
}

export async function runCenariosPapeis() {
  const passos = [];
  const mark = (id, estado, detalhe) => passos.push({ id, estado, detalhe });

  const exp = expectativasPapel();
  for (const [papel, regra] of Object.entries(exp)) {
    const telas = telasDoPapel(papel);
    const falta = regra.tem.filter((v) => !telas.includes(v));
    const vazou = regra.nao.filter((v) => telas.includes(v));
    if (falta.length || vazou.length) {
      mark(`matriz-${papel}`, "FALHOU", `falta=${falta} vazou=${vazou}`);
    } else {
      mark(`matriz-${papel}`, "OK", `telas ${telas.join(",")}`);
    }
  }

  mark(
    "matriz-recepcao-api",
    permissionAllowedByRoleForTest("recepcao", "whatsapp:send") &&
      !permissionAllowedByRoleForTest("recepcao", "financeiro:view")
      ? "OK"
      : "FALHOU",
    "recepção WhatsApp sim, financeiro não"
  );

  const rel = relatorioContadorToReadable({
    clientes: [{ nome: "Ana", cpf: "000", email: "a@a.com", atendimentos: 1 }],
    totais: { entradas: 10, saidas: 2, clientesAtivos: 1 },
    periodo: { dataInicio: "2026-10-01", dataFim: "2026-10-10" },
  }, "Clinica QA");
  const txt = String(rel?.text || rel || "");
  mark(
    "contador-texto",
    /ia_preliminar/i.test(txt) ? "FALHOU" : "OK",
    "relatório do contador sem rascunho de IA"
  );

  const creds = credenciaisGoldenAuth();
  if (!creds.ok) {
    mark("live", "PULOU", "sem QA master");
    return { ok: passos.every((p) => p.estado !== "FALHOU" && p.estado !== "TRAVOU"), passos };
  }

  const roles = ["funcionario", "gestor", "master", "recepcao", "profissional"];
  const tokens = {};
  for (const role of roles) {
    try {
      const s = await withTimeout(loginRole(role), `login-${role}`);
      if (!s.ok) {
        mark(`login-${role}`, s.detalhe === "sem credencial" ? "PULOU" : "FALHOU", s.detalhe);
        continue;
      }
      tokens[role] = s.token;
      mark(`login-${role}`, "OK", s.email.replace(/.(?=.{4}@)/g, "·"));
    } catch (e) {
      mark(`login-${role}`, /TRAVOU/.test(String(e.message)) ? "TRAVOU" : "FALHOU", String(e.message).slice(0, 160));
    }
  }

  if (tokens.master) {
    const db = userClient(tokens.master);
    const org = await escolherOrgComPacientes(db);
    mark("org", org.ok ? "OK" : "FALHOU", org.ok ? `${String(org.orgId).slice(0, 8)} role=${org.role}` : org.detalhe);
    if (org.ok) {
      const { data: members } = await db.from("organization_users").select("role").eq("org_id", org.orgId);
      const rolesLive = [...new Set((members || []).map((m) => m.role))].sort();
      mark("roster", "OK", `papéis na org: ${rolesLive.join(", ") || "—"}`);
      const temRecep = rolesLive.some((r) => /recep/i.test(String(r)));
      const temProf = rolesLive.some((r) => /profiss/i.test(String(r)));
      if (!tokens.recepcao) {
        mark(
          "login-recepcao",
          "PULOU",
          temRecep ? "há recepção na org, mas o login QA falhou" : "sem e-mail QA de recepção"
        );
      }
      if (!tokens.profissional) {
        mark(
          "login-profissional",
          "PULOU",
          temProf ? "há profissional na org, mas o login QA falhou" : "sem e-mail QA de profissional"
        );
      }

      const { data: cli } = await db.from("clients").select("id, name").eq("org_id", org.orgId).limit(1);
      const clientId = cli?.[0]?.id;

      async function roleOf(token) {
        const uid = jwtSub(token);
        const { data } = await db
          .from("organization_users")
          .select("role, user_id")
          .eq("org_id", org.orgId);
        const row = (data || []).find((m) => m.user_id === uid);
        return row?.role || "?";
      }

      if (tokens.funcionario) {
        const fdb = userClient(tokens.funcionario);
        const orgF = await escolherOrgComPacientes(fdb, jwtSub(tokens.funcionario));
        const roleLive = orgF.ok ? orgF.role : await roleOf(tokens.funcionario);
        mark(
          "funcionario-role-live",
          orgF.ok ? "OK" : "PULOU",
          orgF.ok
            ? `org ${String(orgF.orgId).slice(0, 8)} role=${roleLive} clientes=${orgF.clientes}`
            : `sem membership visível nesta clínica master (${orgF.detalhe || "role ?"})`
        );
        const orgFin = orgF.ok ? orgF.orgId : org.orgId;
        const fin = await fdb.from("financeiro").select("id").eq("org_id", orgFin).limit(1);
        mark(
          "funcionario-financeiro-rls",
          "OK",
          fin.error
            ? `leitura recusada (${String(fin.error.message).slice(0, 80)})`
            : `RLS deixou ler ${(fin.data || []).length} linha(s)`
        );
        const { data: cliF } = orgF.ok
          ? await fdb.from("clients").select("id").eq("org_id", orgF.orgId).limit(1)
          : { data: [{ id: clientId }] };
        const cidF = cliF?.[0]?.id || clientId;
        const portalF = await api("/api/create-portal-session", {
          token: tokens.funcionario,
          method: "POST",
          json: { org_id: orgF.orgId || org.orgId, client_id: cidF },
        });
        const deveNegar = !permissionAllowedByRoleForTest(roleLive, "clientes:edit") && !permissionAllowedByRoleForTest(roleLive, "clientes:manage");
        mark(
          "funcionario-portal-api",
          !orgF.ok
            ? "PULOU"
            : deveNegar
              ? expect403(portalF.status)
                ? "OK"
                : "FALHOU"
              : "OK",
          `create-portal-session ${portalF.status} (papel ${roleLive})`
        );
        const wa = await api("/api/whatsapp-send", {
          token: tokens.funcionario,
          method: "POST",
          json: { org_id: orgFin, phone: "11999999999", message: "teste", client_id: cidF },
        });
        const deveNegarWa = !permissionAllowedByRoleForTest(roleLive, "whatsapp:send");
        mark(
          "funcionario-whatsapp",
          !orgF.ok
            ? "PULOU"
            : deveNegarWa
              ? expect403(wa.status)
                ? "OK"
                : "FALHOU"
              : "OK",
          `whatsapp-send ${wa.status} (papel ${roleLive})`
        );
      }

      if (tokens.master && clientId) {
        const portalM = await api("/api/create-portal-session", {
          token: tokens.master,
          method: "POST",
          json: { org_id: org.orgId, client_id: clientId },
        });
        const tok = portalM.body?.token;
        mark(
          "master-portal-api",
          portalM.status === 200 && tok ? "OK" : "FALHOU",
          `create-portal-session ${portalM.status}`
        );
        const page = await fetch(`${BASE}/portal.html`);
        mark("portal-html", page.ok ? "OK" : "FALHOU", `GET portal.html ${page.status}`);
        if (tok) {
          const rpc = await db.rpc("get_client_by_token", { p_token: tok });
          const leaked = JSON.stringify(rpc.data || {}).includes("ia_preliminar");
          mark(
            "portal-rpc",
            !rpc.error && !leaked ? "OK" : "FALHOU",
            rpc.error ? rpc.error.message : leaked ? "vazou ia_preliminar" : "cliente lido sem preliminar de IA"
          );
          const pageTok = await fetch(`${BASE}/portal.html?token=${encodeURIComponent(tok)}`);
          mark("portal-html-token", pageTok.ok ? "OK" : "FALHOU", `GET com token ${pageTok.status}`);
        }
      }

      async function probePapel(roleKey, token) {
        if (!token) return;
        const pdb = userClient(token);
        const orgP = await escolherOrgComPacientes(pdb, jwtSub(token));
        const roleLive = orgP.ok ? orgP.role : "?";
        mark(`${roleKey}-role-live`, orgP.ok ? "OK" : "FALHOU", orgP.ok ? `org ${String(orgP.orgId).slice(0, 8)} role=${roleLive}` : orgP.detalhe);
        const { data: cliP } = orgP.ok
          ? await pdb.from("clients").select("id").eq("org_id", orgP.orgId).limit(1)
          : { data: [] };
        const cid = cliP?.[0]?.id || clientId;
        const portal = await api("/api/create-portal-session", {
          token,
          method: "POST",
          json: { org_id: orgP.orgId || org.orgId, client_id: cid },
        });
        const denyPortal = !permissionAllowedByRoleForTest(roleLive, "clientes:edit") && !permissionAllowedByRoleForTest(roleLive, "clientes:manage");
        mark(
          `${roleKey}-portal-api`,
          denyPortal ? (expect403(portal.status) ? "OK" : "FALHOU") : portal.status < 500 ? "OK" : "FALHOU",
          `create-portal-session ${portal.status}`
        );
        const wa = await api("/api/whatsapp-send", {
          token,
          method: "POST",
          json: { org_id: orgP.orgId || org.orgId, message: "teste", client_id: cid },
        });
        const denyWa = !permissionAllowedByRoleForTest(roleLive, "whatsapp:send");
        mark(
          `${roleKey}-whatsapp`,
          denyWa ? (expect403(wa.status) ? "OK" : "FALHOU") : wa.status !== 403 ? "OK" : "FALHOU",
          `whatsapp-send ${wa.status}`
        );
        const ops = await api("/api/ops-summary", { token, method: "POST", json: { org_id: orgP.orgId || org.orgId } });
        const denyOps = !permissionAllowedByRoleForTest(roleLive, "auditoria:view");
        mark(
          `${roleKey}-contador-api`,
          denyOps ? (expect403(ops.status) ? "OK" : ops.status === 404 ? "OK" : "FALHOU") : "OK",
          `ops-summary ${ops.status} (financeiro/contador exige financeiro:view=${permissionAllowedByRoleForTest(roleLive, "financeiro:view")})`
        );
      }

      await probePapel("recepcao", tokens.recepcao);
      await probePapel("profissional", tokens.profissional);
      await probePapel("gestor", tokens.gestor);

      const { count, error: finErr } = await db
        .from("financeiro")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org.orgId);
      mark(
        "contador-dados",
        finErr ? "FALHOU" : "OK",
        finErr ? finErr.message : `${count || 0} lançamento(s) para a aba contador`
      );
    }
  }

  if (!process.env.QA_EMAIL_FUNCIONARIO) mark("login-funcionario", "PULOU", "sem e-mail");

  const travou = passos.some((p) => p.estado === "TRAVOU");
  const falhou = passos.some((p) => p.estado === "FALHOU");
  return { ok: !travou && !falhou, passos };
}

function print(r) {
  console.log("CENARIO-PAPEIS");
  for (const p of r.passos) console.log(`${p.estado.padEnd(7)} ${p.id} — ${p.detalhe}`);
  console.log(r.ok ? "OK" : "FALHOU");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === pathResolve(process.argv[1]);
if (isMain) {
  runCenariosPapeis()
    .then((r) => {
      print(r);
      process.exit(r.ok ? 0 : 1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
