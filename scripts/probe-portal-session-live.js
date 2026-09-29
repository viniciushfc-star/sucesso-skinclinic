/**
 * Prova live: create_client_portal_session + get_client_by_token.
 * Não imprime token nem nome de cliente. Expira a sessão criada.
 *
 *   node scripts/probe-portal-session-live.js
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { credenciaisGoldenAuth, escolherOrgComPacientes } from "../js/utils/golden-flow-auth.js";

function line(ok, msg) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
}

async function main() {
  const creds = credenciaisGoldenAuth();
  if (!creds.ok) {
    console.error("Falta SUPABASE_URL / ANON / QA_EMAIL_MASTER / QA_PASS_MASTER");
    process.exit(2);
  }
  const authRes = await fetch(`${creds.url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: creds.anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  });
  const authJson = await authRes.json().catch(() => ({}));
  if (!authRes.ok || !authJson.access_token) {
    console.error("login falhou", authRes.status);
    process.exit(2);
  }
  const db = createClient(creds.url, creds.anon, {
    global: { headers: { Authorization: `Bearer ${authJson.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const org = await escolherOrgComPacientes(db);
  if (!org.ok) {
    line(false, `org: ${org.detalhe}`);
    process.exit(1);
  }

  const { data: cli, error: cliErr } = await db
    .from("clients")
    .select("id")
    .eq("org_id", org.orgId)
    .limit(1)
    .maybeSingle();
  if (cliErr || !cli?.id) {
    line(false, `sem cliente na org (${cliErr?.message || "vazio"})`);
    process.exit(1);
  }

  const lixo = await db.rpc("get_client_by_token", { p_token: "token-invalido-probe-portal" });
  if (lixo.error) {
    const code = lixo.error.code || "";
    line(false, `get_client_by_token token lixo: ${code} ${lixo.error.message}`);
  } else {
    const rows = Array.isArray(lixo.data) ? lixo.data : lixo.data ? [lixo.data] : [];
    line(rows.length === 0, `get_client_by_token token lixo linhas=${rows.length}`);
  }

  const rpc = await db.rpc("create_client_portal_session", {
    p_org_id: org.orgId,
    p_client_id: cli.id,
  });
  if (rpc.error) {
    line(false, `create_client_portal_session: ${rpc.error.code || ""} ${rpc.error.message}`);
    process.exit(1);
  }
  const token = typeof rpc.data === "string" ? rpc.data : rpc.data?.token;
  if (!token || typeof token !== "string") {
    line(false, `RPC sem token (tipo ${typeof rpc.data})`);
    process.exit(1);
  }
  line(true, `create_client_portal_session devolveu token len=${token.length}`);

  const byTok = await db.rpc("get_client_by_token", { p_token: token });
  if (byTok.error) {
    line(false, `get_client_by_token com token fresco: ${byTok.error.code || ""} ${byTok.error.message}`);
  } else {
    const row = Array.isArray(byTok.data) ? byTok.data[0] : byTok.data;
    const idOk = row && (row.id === cli.id || row.client_id === cli.id);
    const prelim = /ia_preliminar/i.test(JSON.stringify(row || ""));
    line(Boolean(idOk) && !prelim, `get_client_by_token id_bate=${Boolean(idOk)} ia_preliminar=${prelim}`);
  }

  const sess = await db.rpc("get_client_session_by_token", { p_token: token });
  if (sess.error) {
    line(false, `get_client_session_by_token: ${sess.error.code || ""} ${sess.error.message}`);
  } else {
    const row = Array.isArray(sess.data) ? sess.data[0] : sess.data;
    line(Boolean(row?.client_id === cli.id || row?.org_id), "get_client_session_by_token leu a sessão");
  }

  const peleLixo = await db.rpc("get_analises_pele_by_token", { p_token: "token-invalido-probe-portal" });
  if (peleLixo.error) {
    line(false, `get_analises_pele_by_token token lixo: ${peleLixo.error.code || ""} ${peleLixo.error.message}`);
  } else {
    const rows = Array.isArray(peleLixo.data) ? peleLixo.data : peleLixo.data ? [peleLixo.data] : [];
    const prelim = /ia_preliminar/i.test(JSON.stringify(peleLixo.data || ""));
    line(rows.length === 0 && !prelim, `get_analises_pele_by_token token lixo linhas=${rows.length} ia_preliminar=${prelim}`);
  }

  const pele = await db.rpc("get_analises_pele_by_token", { p_token: token });
  if (pele.error) {
    line(false, `get_analises_pele_by_token: ${pele.error.code || ""} ${pele.error.message}`);
  } else {
    const rows = Array.isArray(pele.data) ? pele.data : pele.data ? [pele.data] : [];
    const prelim = /ia_preliminar/i.test(JSON.stringify(pele.data || ""));
    line(!prelim, `get_analises_pele_by_token ok linhas=${rows.length} ia_preliminar=${prelim}`);
  }

  const { error: expErr } = await db
    .from("client_sessions")
    .update({ expires_at: new Date(0).toISOString() })
    .eq("client_id", cli.id)
    .eq("org_id", org.orgId);
  if (expErr) line(false, `expirar sessão: ${expErr.message}`);
  else line(true, "sessão de prova expirada (expires_at no passado)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
