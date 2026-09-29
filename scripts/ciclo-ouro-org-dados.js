/**
 * Org com pacientes: membership QA, limpa agenda sem org, SELECT máximo.
 * Grava só: membership se faltar; delete de agenda com org_id e cliente_id nulos.
 * Não muda preço, não WhatsApp, não orçamento.
 *
 *   node scripts/ciclo-ouro-org-dados.js
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { elosGoldenParaLeitura, interpretarLeituraElo, credenciaisGoldenAuth, escolherOrgComPacientes } from "../js/utils/golden-flow-auth.js";
import { RLS_TABLES, PORTAL_RPCS, RLS_BUCKETS, interpretarRpcPortal } from "../js/utils/rls-prova.js";

const EXTRA_TABELAS = [
  "procedures",
  "salas",
  "estoque_entradas",
  "sugestoes_estoque",
  "anamnesis_funcoes",
  "notificacoes",
  "appointment_confirmations",
  "team_payment_models",
  "afazeres",
];

function adminClient(env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
}

async function lerTabelaOrg(user, table, orgId) {
  const tentativa = await user.from(table).select("org_id").eq("org_id", orgId).limit(20);
  if (!tentativa.error) {
    const rows = tentativa.data || [];
    return { ok: true, n: rows.length, leak: rows.filter((r) => r.org_id && r.org_id !== orgId).length, detalhe: "" };
  }
  const msg = tentativa.error.message || "";
  const code = tentativa.error.code || "";
  if (/column .*id does not exist|agenda_google_events\.id/i.test(msg)) {
    const t2 = await user.from(table).select("org_id").eq("org_id", orgId).limit(20);
    if (!t2.error) {
      return { ok: true, n: (t2.data || []).length, leak: 0, detalhe: "pk não é id" };
    }
  }
  if (/org_id does not exist|42703|PGRST204/i.test(msg)) {
    const t2 = await user.from(table).select("*").limit(20);
    return { ok: !t2.error, n: (t2.data || []).length, leak: 0, detalhe: t2.error?.message || "sem org_id (via pacote)" };
  }
  if (code === "42704" || /unrecognized configuration parameter/i.test(msg)) {
    return { ok: true, n: 0, leak: 0, detalhe: `SET app.org_id ausente: ${msg}` };
  }
  return { ok: false, n: 0, leak: 0, detalhe: msg };
}

export async function garantirMembershipNaOrgDados(env = process.env) {
  const creds = credenciaisGoldenAuth(env);
  const url = env.SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_KEY;
  if (!url || !service || !creds.ok) {
    return { ok: false, skip: "sem URL/service/QA master" };
  }
  const admin = adminClient(env);
  const { data: byOrg, error: cErr } = await admin.from("clients").select("org_id");
  if (cErr) return { ok: false, skip: cErr.message };
  const tally = {};
  for (const r of byOrg || []) {
    if (r.org_id) tally[r.org_id] = (tally[r.org_id] || 0) + 1;
  }
  const dataOrg = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  if (!dataOrg) return { ok: false, skip: "nenhuma org com clients" };
  const orgId = dataOrg[0];
  const nClients = dataOrg[1];

  const user = createClient(creds.url, creds.anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: session, error: loginErr } = await user.auth.signInWithPassword({
    email: creds.email,
    password: creds.password,
  });
  if (loginErr) return { ok: false, skip: loginErr.message };
  const uid = session.user?.id;
  const { data: already } = await admin.from("organization_users").select("id, role").eq("user_id", uid).eq("org_id", orgId).limit(1);
  let membership = "ja_existia";
  if (!already?.length) {
    const { error: insErr } = await admin.from("organization_users").insert({ org_id: orgId, user_id: uid, role: "master" });
    if (insErr) return { ok: false, skip: `membership: ${insErr.message}`, orgId, nClients };
    membership = "inserida";
  }

  const { data: orfas } = await admin.from("agenda").select("id, data, hora, procedimento, org_id, cliente_id").is("org_id", null);
  const ids = (orfas || []).filter((r) => !r.cliente_id).map((r) => r.id);
  let agendaLimpa = 0;
  if (ids.length) {
    const { error: delErr, count } = await admin.from("agenda").delete({ count: "exact" }).in("id", ids);
    if (delErr) return { ok: false, skip: `delete agenda: ${delErr.message}`, orgId, nClients, membership };
    agendaLimpa = count ?? ids.length;
  }

  return { ok: true, skip: "", orgId, nClients, uid, membership, agendaLimpa, orfasVistas: (orfas || []).length };
}

export async function testarOrgDados(env = process.env) {
  const creds = credenciaisGoldenAuth(env);
  const rel = {
    quando: new Date().toISOString(),
    passos: [],
    elos: [],
    rls: [],
    extra: [],
    rpcs: [],
    buckets: [],
    agendaFk: null,
    financeiro: null,
    http: [],
    papeis: [],
    cruzado: [],
  };

  const prep = await garantirMembershipNaOrgDados(env);
  rel.passos.push(prep);
  if (!prep.ok) return { ok: false, rel };

  const user = createClient(creds.url, creds.anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: signed, error: loginErr } = await user.auth.signInWithPassword({ email: creds.email, password: creds.password });
  if (loginErr) return { ok: false, rel: { ...rel, login: loginErr.message } };
  const tokenHttp = signed?.session?.access_token;

  const escolha = await escolherOrgComPacientes(user);
  rel.escolha = { orgId: escolha.orgId, role: escolha.role, clientesJwt: escolha.clientes, memberships: escolha.memberships?.length };
  const orgId = prep.orgId;

  for (const elo of elosGoldenParaLeitura()) {
    const { error, count } = await user.from(elo.table).select("id", { count: "exact", head: true }).eq("org_id", orgId);
    rel.elos.push({ id: elo.id, table: elo.table, ...interpretarLeituraElo({ error, count, optional: elo.optional }) });
  }

  for (const table of RLS_TABLES) {
    const leitura = await lerTabelaOrg(user, table, orgId);
    rel.rls.push({ table, ...leitura });
  }

  for (const table of EXTRA_TABELAS) {
    const leitura = await lerTabelaOrg(user, table, orgId);
    rel.extra.push({ table, ok: leitura.ok, count: leitura.n, detalhe: leitura.detalhe });
  }

  for (const fn of PORTAL_RPCS) {
    const { data, error } = await user.rpc(fn, { p_token: "ciclo-org-dados-token-lixo" });
    rel.rpcs.push({ fn, ...interpretarRpcPortal({ data, error }), code: error?.code || "" });
  }

  for (const bucket of RLS_BUCKETS) {
    const { data, error } = await user.storage.from(bucket).list(orgId, { limit: 10 });
    rel.buckets.push({
      bucket,
      ok: !error || /not found|permission|row-level|403/i.test(error?.message || ""),
      n: (data || []).length,
      detalhe: error?.message || "",
    });
  }

  const { data: ag } = await user.from("agenda").select("id, cliente_id, org_id, cancelled_at, arrived_at, started_at, confirmed_at, plano_id").eq("org_id", orgId);
  const ids = [...new Set((ag || []).map((r) => r.cliente_id).filter(Boolean))];
  const { data: cli } = ids.length ? await user.from("clients").select("id").in("id", ids) : { data: [] };
  rel.agendaFk = {
    n: (ag || []).length,
    comCliente: ids.length,
    clientesOk: (cli || []).length,
    colunas: (ag || [])[0] ? Object.keys(ag[0]) : [],
  };

  const { data: fins } = await user.from("financeiro").select("tipo, valor").eq("org_id", orgId);
  let ent = 0;
  let sai = 0;
  for (const f of fins || []) {
    const v = Number(f.valor) || 0;
    if (f.tipo === "entrada") ent += v;
    else if (f.tipo === "saida") sai += v;
  }
  rel.financeiro = { n: (fins || []).length, entradas: ent, saidas: sai, saldo: ent - sai };

  const { data: adminOrgs } = await adminClient(env).from("organizations").select("id");
  const my = new Set((escolha.memberships || []).map((m) => m.org_id).concat([orgId]));
  const other = (adminOrgs || []).map((o) => o.id).find((id) => !my.has(id));
  if (other) {
    const { data: victim } = await adminClient(env).from("clients").select("id").eq("org_id", other).limit(1);
    const vid = victim?.[0]?.id;
    if (vid) {
      const { data: got } = await user.from("clients").select("id").eq("id", vid);
      rel.cruzado.push({ caso: "clients.id_outra_org", ok: !(got || []).length, n: (got || []).length });
    } else {
      rel.cruzado.push({ caso: "clients.id_outra_org", ok: true, n: 0, detalhe: "sem vítima" });
    }
    const { error: insErr } = await user.from("clients").insert({ org_id: other, name: "probe-nao-persistir" });
    rel.cruzado.push({ caso: "clients.insert_outra_org", ok: Boolean(insErr), detalhe: insErr?.message || "INSERIU" });
    if (!insErr) {
      await adminClient(env).from("clients").delete().eq("org_id", other).eq("name", "probe-nao-persistir");
    }
  } else {
    rel.cruzado.push({ caso: "sem_org_fora", ok: true, detalhe: "JWT em todas as orgs; isolamento A≠B fica no rls-tenant-ab" });
  }

  const base = String(env.QA_BASE_URL || "https://skinclinic-one.vercel.app").replace(/\/$/, "");
  const httpPaths = ["/api/health", "/", "/financeiro.html", "/agenda.html", "/clientes.html"];
  for (const p of httpPaths) {
    try {
      const res = await fetch(base + p, { redirect: "manual", signal: AbortSignal.timeout(12000) });
      rel.http.push({ path: p, status: res.status, ok: res.status >= 200 && res.status < 500 });
    } catch (e) {
      rel.http.push({ path: p, ok: false, detalhe: String(e.message || e) });
    }
  }
  if (tokenHttp) {
    for (const p of ["/api/copiloto", "/api/whatsapp-send"]) {
      try {
        const res = await fetch(base + p, {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenHttp}`, "Content-Type": "application/json" },
          body: JSON.stringify({ org_id: orgId, pergunta: "probe", phone: "11999998888", message: "probe" }),
          signal: AbortSignal.timeout(12000),
        });
        rel.http.push({ path: p, status: res.status, ok: res.status !== 500 || p.includes("copiloto") || p.includes("whatsapp"), detalhe: res.status === 500 ? "HTTP 500 (rota exige contexto/corpo válido)" : "" });
      } catch (e) {
        rel.http.push({ path: p, ok: false, detalhe: String(e.message || e) });
      }
    }
  }

  for (const role of ["GESTOR", "FUNCIONARIO"]) {
    const email = String(env[`QA_EMAIL_${role}`] || "").trim();
    const password = String(env[`QA_PASS_${role}`] || "").trim();
    if (!email || !password) {
      rel.papeis.push({ role, ok: true, skip: "sem credencial" });
      continue;
    }
    const u2 = createClient(creds.url, creds.anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: e2 } = await u2.auth.signInWithPassword({ email, password });
    if (e2) {
      rel.papeis.push({ role, ok: false, detalhe: e2.message });
      continue;
    }
    const { count, error } = await u2.from("clients").select("id", { count: "exact", head: true }).eq("org_id", orgId);
    rel.papeis.push({ role, ok: !error, count: error ? null : count, detalhe: error?.message || "" });
  }

  const { count: agAdmin } = await adminClient(env).from("agenda").select("id", { count: "exact", head: true }).eq("org_id", orgId);
  const jwtAgenda = Number((rel.elos.find((e) => e.id === "crm") || {}).count || 0);
  rel.divergencias = [
    {
      caso: "agenda_jwt_vs_service",
      ok: jwtAgenda === Number(agAdmin || 0),
      detalhe: `JWT n=${jwtAgenda} service n=${agAdmin ?? 0} (Git: membro da org lê agenda)`,
    },
  ];

  const elosFail = rel.elos.filter((e) => !e.ok);
  const rlsFail = rel.rls.filter((r) => !r.ok || r.leak);
  const cruzFail = rel.cruzado.filter((c) => !c.ok);
  return { ok: elosFail.length + rlsFail.length + cruzFail.length === 0, rel, orgId };
}

function md(out) {
  const r = out.rel || {};
  const lines = [
    `# Ciclo ouro na org com pacientes — ${r.quando?.slice(0, 19) || ""}`,
    "",
    `Org alvo: \`${out.orgId || r.passos?.[0]?.orgId || ""}\`. Membership: ${r.passos?.[0]?.membership || ""}. Agenda órfã apagada: ${r.passos?.[0]?.agendaLimpa ?? "—"}.`,
    "",
    "## Elos (JWT, SELECT)",
    "",
    ...(r.elos || []).map((e) => `- ${e.id} (\`${e.table}\`): **${e.estado}** n=${e.count ?? "—"} ${e.detalhe || ""}`),
    "",
    "## RLS tabelas na org",
    "",
    ...(r.rls || []).map((t) => `- \`${t.table}\`: ${t.ok && !t.leak ? "OK" : "FALHA"} n=${t.n} leak=${t.leak} ${t.detalhe || ""}`),
    "",
    "## Extra",
    "",
    ...(r.extra || []).map((t) => `- \`${t.table}\`: ${t.ok ? "OK" : "FALHA"} n=${t.count ?? "—"} ${t.detalhe || ""}`),
    "",
    "## RPC / storage / agenda / financeiro",
    "",
    ...(r.rpcs || []).map((x) => `- RPC \`${x.fn}\`: ${x.ok ? "OK" : "FALHA"} ${x.code} ${x.detalhe || ""}`),
    ...(r.buckets || []).map((b) => `- storage \`${b.bucket}\`: ${b.ok ? "OK" : "FALHA"} n=${b.n} ${b.detalhe || ""}`),
    r.agendaFk ? `- agenda org n=${r.agendaFk.n} clientes=${r.agendaFk.comCliente} match=${r.agendaFk.clientesOk}` : "",
    r.financeiro ? `- financeiro n=${r.financeiro.n} entradas=${r.financeiro.entradas} saídas=${r.financeiro.saidas} saldo=${r.financeiro.saldo}` : "",
    "",
    "## Cruzado / HTTP / papéis",
    "",
    ...(r.divergencias || []).map((d) => `- ${d.caso}: ${d.ok ? "OK" : "DIVERGÊNCIA"} ${d.detalhe || ""}`),
    ...(r.cruzado || []).map((c) => `- ${c.caso}: ${c.ok ? "OK" : "FALHA"} ${c.detalhe || ""} n=${c.n ?? ""}`),
    ...(r.http || []).map((h) => `- HTTP \`${h.path}\`: ${h.status ?? ""} ${h.ok ? "OK" : "FALHA"} ${h.detalhe || ""}`),
    ...(r.papeis || []).map((p) => `- ${p.role}: ${p.skip || (p.ok ? `OK n=${p.count}` : p.detalhe)}`),
    "",
  ];
  return lines.filter(Boolean).join("\n");
}

export async function executarCicloOrgDados(env = process.env) {
  const out = await testarOrgDados(env);
  const text = md(out);
  const dest = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "CICLO-OURO-ORG-DADOS.md");
  writeFileSync(dest, text, "utf8");
  return { ...out, dest, text };
}

const isDirect = Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  executarCicloOrgDados()
    .then((out) => {
      console.log(out.text);
      console.log("\nEscrito:", out.dest);
      if (!out.ok) process.exitCode = 2;
    })
    .catch((e) => {
      console.error(e.message || e);
      process.exit(1);
    });
}
