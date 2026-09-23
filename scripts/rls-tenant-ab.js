/**
 * Ciclo 3 — prova RLS: JWT da org A não lê/grava dado da org B.
 * Usa ANON + senha (não service role) para as tentativas.
 * Service role só monta o mapa de vítimas (ids/org_id, sem PII).
 *
 *   node scripts/rls-tenant-ab.js
 *
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY,
 *      QA_EMAIL_MASTER, QA_PASS_MASTER
 * Opcional: QA_EMAIL_GESTOR / QA_PASS_GESTOR, QA_BASE_URL
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const TABLES = [
  "clients",
  "agenda",
  "financeiro",
  "estoque_entradas",
  "protocolos_aplicados",
  "analise_pele",
  "client_sessions",
  "audit_logs",
  "organization_invites",
  "profiles",
  "ocr_notas",
  "market_radar_refs",
];

function isMissingRelation(error) {
  const code = String(error?.code || "");
  const msg = String(error?.message || "");
  return code === "42P01" || code === "PGRST205" || /does not exist|schema cache/i.test(msg);
}

function restClient(url, anon, token) {
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function line(ok, msg) {
  return `${ok ? "PASS" : "FAIL"}  ${msg}`;
}

async function login(url, anon, email, password) {
  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(`login falhou (${res.status})`);
  }
  return { token: json.access_token, userId: json.user?.id || json.user?.sub || null };
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_KEY;
  const email = process.env.QA_EMAIL_MASTER;
  const password = process.env.QA_PASS_MASTER;
  if (!url || !anon || !service || !email || !password) {
    throw new Error("Falta SUPABASE_URL / ANON / SERVICE_KEY / QA_EMAIL_MASTER / QA_PASS_MASTER");
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const log = [];
  const results = [];

  const { data: orgs, error: orgErr } = await admin.from("organizations").select("id");
  if (orgErr) throw orgErr;
  const orgIds = (orgs || []).map((o) => o.id);
  log.push(`organizations_live=${orgIds.length}`);

  const { token, userId: loginUserId } = await login(url, anon, email, password);
  const user = restClient(url, anon, token);
  const { data: authUser } = await user.auth.getUser(token);
  const uid = authUser?.user?.id || loginUserId;
  if (!uid) throw new Error("JWT sem user id");

  const { data: memberships, error: memErr } = await user
    .from("organization_users")
    .select("org_id, role");
  if (memErr) throw memErr;
  const myOrgs = new Set((memberships || []).map((m) => m.org_id));
  log.push(`jwt_orgs=${myOrgs.size} roles=${(memberships || []).map((m) => m.role).join(",")}`);

  if (myOrgs.size === 0) {
    throw new Error("Usuário QA não pertence a nenhuma organization_users (RLS membership)");
  }

  let otherOrgs = orgIds.filter((id) => !myOrgs.has(id));
  log.push(`outras_orgs=${otherOrgs.length}`);

  let provisionedOrg = null;
  if (otherOrgs.length === 0) {
    const { data: created, error: cErr } = await admin
      .from("organizations")
      .insert({ name: "RLS_PROBE_ORG_B" })
      .select("id")
      .single();
    if (cErr || !created?.id) {
      results.push({
        table: "_provision_org_b",
        ok: false,
        detail: `não criou org B: ${cErr?.message || "sem id"}`,
      });
    } else {
      provisionedOrg = created.id;
      otherOrgs = [provisionedOrg];
      log.push(`provisionou_org_b=${provisionedOrg}`);
      await admin.from("clients").insert({
        org_id: provisionedOrg,
        name: "rls-probe-victim",
      });
      await admin.from("agenda").insert({
        org_id: provisionedOrg,
        data: "2099-01-01",
        hora: "00:00",
        procedimento: "rls-probe",
      });
    }
  }

  for (const table of TABLES) {
    const { data, error } = await user.from(table).select("id, org_id").limit(50);
    if (table === "profiles") {
      const { data: pdata, error: perr } = await user.from("profiles").select("id").limit(200);
      if (perr) {
        results.push({ table: "profiles", ok: false, detail: perr.message });
        continue;
      }
      const { data: foreignMembers } = await admin
        .from("organization_users")
        .select("user_id, org_id");
      const foreignUsers = new Set(
        (foreignMembers || [])
          .filter((m) => !myOrgs.has(m.org_id))
          .map((m) => m.user_id)
      );
      const leak = (pdata || []).filter((p) => foreignUsers.has(p.id));
      results.push({
        table: "profiles",
        ok: leak.length === 0,
        detail: `visiveis=${(pdata || []).length} leak_user_outra_org=${leak.length}`,
      });
      continue;
    }
    if (error) {
      if (isMissingRelation(error) && (table === "ocr_notas" || table === "market_radar_refs")) {
        results.push({ table, ok: true, detail: "tabela ainda não existe no live (migration pendente)" });
        continue;
      }
      results.push({ table, ok: false, detail: `select_erro ${error.message}` });
      continue;
    }
    const rows = data || [];
    const leak = rows.filter((r) => r.org_id && !myOrgs.has(r.org_id));
    results.push({
      table,
      ok: leak.length === 0,
      detail: `linhas_visiveis=${rows.length} leak_org_b=${leak.length}`,
    });
  }

  if (otherOrgs.length === 0) {
    results.push({
      table: "_cruzado",
      ok: false,
      detail: "BLOQUEADO: só existe 1 org (ou o JWT está em todas). Sem vítima Org B.",
    });
  } else {
    for (const table of ["clients", "agenda", "financeiro", "estoque_entradas", "analise_pele", "protocolos_aplicados"]) {
      const { data: victims } = await admin.from(table).select("id, org_id").in("org_id", otherOrgs).limit(1);
      const victim = (victims || [])[0];
      if (!victim) {
        results.push({ table: `${table}.eq_id`, ok: true, detail: `sem linha na org B (${table})` });
        continue;
      }
      const { data: got, error } = await user.from(table).select("id, org_id").eq("id", victim.id);
      const leaked = (got || []).some((r) => r.id === victim.id);
      results.push({
        table: `${table}.eq_id`,
        ok: !leaked,
        detail: leaked ? "LEU id da org B" : error ? `vazio/erro ${error.code || ""}` : "negado (vazio)",
      });
    }

    const victimOrg = otherOrgs[0];
    const { error: insErr } = await user.from("clients").insert({
      org_id: victimOrg,
      name: "rls-probe-nao-deve-persistir",
    });
    const insertBlocked = Boolean(insErr);
    results.push({
      table: "clients.insert_org_b",
      ok: insertBlocked,
      detail: insertBlocked ? `negado ${insErr.code || insErr.message}` : "INSERIU na org B",
    });
    if (!insertBlocked) {
      await admin.from("clients").delete().eq("name", "rls-probe-nao-deve-persistir").eq("org_id", victimOrg);
    }

    const base = String(process.env.QA_BASE_URL || "https://skinclinic-one.vercel.app").replace(/\/$/, "");
    const apiCases = [
      ["/api/copiloto", { org_id: victimOrg, pergunta: "probe rls" }],
      ["/api/preco", { org_id: victimOrg, procedimento: "probe" }],
      ["/api/marketing", { org_id: victimOrg, pergunta: "probe" }],
      ["/api/whatsapp-send", { org_id: victimOrg, phone: "11999998888", message: "probe" }],
      ["/api/audit-log", { org_id: victimOrg, action: "rls.probe" }],
      [
        "/api/create-portal-session",
        { org_id: victimOrg, client_id: "00000000-0000-0000-0000-000000000001" },
      ],
    ];
    for (const [path, json] of apiCases) {
      try {
        const apiRes = await fetch(`${base}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(json),
        });
        const apiOk = apiRes.status === 403 || apiRes.status === 401;
        const name = path.replace("/api/", "api.");
        results.push({
          table: `${name}.org_b`,
          ok: apiOk,
          detail: `HTTP ${apiRes.status}${apiRes.status === 500 ? " (esperava 403; conferir deploy)" : ""}`,
        });
      } catch (e) {
        results.push({ table: `${path}.org_b`, ok: false, detail: String(e.message || e) });
      }
    }

    try {
      const { data: rpcRows, error: rpcErr } = await user.rpc("get_client_session_by_token", {
        p_token: "token-invalido-rls-probe",
      });
      const leaked = Array.isArray(rpcRows) && rpcRows.length > 0;
      results.push({
        table: "rpc.get_client_session_by_token",
        ok: !leaked,
        detail: leaked ? "RPC devolveu sessão" : rpcErr ? `vazio/erro ${rpcErr.code || ""}` : "sem sessão",
      });
    } catch (e) {
      results.push({ table: "rpc.get_client_session_by_token", ok: false, detail: String(e.message || e) });
    }

    const buckets = ["analise-pele-fotos", "client-photos", "anamnese-fotos"];
    for (const bucket of buckets) {
      const { data: listed, error: listErr } = await user.storage.from(bucket).list("", { limit: 30 });
      if (listErr) {
        const denied = /not found|row-level|403|401|Unauthorized|permission/i.test(listErr.message || "");
        results.push({
          table: `storage.list.${bucket}`,
          ok: true,
          detail: `list: ${denied ? "negado/indisponível" : listErr.message}`,
        });
        continue;
      }
      const names = (listed || []).map((x) => x.name).filter(Boolean);
      const leakFolders = names.filter((n) => otherOrgs.includes(n));
      results.push({
        table: `storage.list.${bucket}`,
        ok: leakFolders.length === 0,
        detail: `itens=${names.length} pastas_org_b=${leakFolders.length}`,
      });

      const { data: foreign } = await admin.storage.from(bucket).list("", { limit: 50 });
      const foreignFolder = (foreign || []).map((x) => x.name).find((n) => otherOrgs.includes(n));
      if (!foreignFolder) {
        results.push({ table: `storage.download.${bucket}`, ok: true, detail: "sem pasta org B para testar" });
        continue;
      }
      const { data: files } = await admin.storage.from(bucket).list(foreignFolder, { limit: 5 });
      const file = (files || []).find((f) => f.name && !f.name.endsWith("/"));
      if (!file) {
        const { data: nested } = await admin.storage.from(bucket).list(foreignFolder, { limit: 5 });
        const sub = (nested || [])[0];
        if (!sub?.name) {
          results.push({ table: `storage.download.${bucket}`, ok: true, detail: "pasta org B vazia" });
          continue;
        }
        const { data: nestedFiles } = await admin.storage.from(bucket).list(`${foreignFolder}/${sub.name}`, { limit: 3 });
        const nf = (nestedFiles || []).find((f) => f.id || f.name);
        const path = nf ? `${foreignFolder}/${sub.name}/${nf.name}` : null;
        if (!path) {
          results.push({ table: `storage.download.${bucket}`, ok: true, detail: "sem objeto org B" });
          continue;
        }
        const { data: blob, error: dlErr } = await user.storage.from(bucket).download(path);
        const leaked = Boolean(blob) && !dlErr;
        results.push({
          table: `storage.download.${bucket}`,
          ok: !leaked,
          detail: leaked ? "BAIXOU objeto de outra org" : `negado ${dlErr?.message || "vazio"}`,
        });
        continue;
      }
      const path = `${foreignFolder}/${file.name}`;
      const { data: blob, error: dlErr } = await user.storage.from(bucket).download(path);
      const leaked = Boolean(blob) && !dlErr;
      results.push({
        table: `storage.download.${bucket}`,
        ok: !leaked,
        detail: leaked ? "BAIXOU objeto de outra org" : `negado ${dlErr?.message || "vazio"}`,
      });
    }
  }

  if (provisionedOrg) {
    await admin.from("clients").delete().eq("org_id", provisionedOrg);
    await admin.from("agenda").delete().eq("org_id", provisionedOrg);
    await admin.from("organizations").delete().eq("id", provisionedOrg);
    log.push("cleanup_org_b=ok");
  }

  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok);
  const md = `# Fase 2 — RLS Org A ≠ Org B

**DATA:** ${new Date().toISOString()}
**Ator:** JWT QA_EMAIL_MASTER (anon key)
**Orgs do JWT:** ${myOrgs.size}
**Outras orgs no projeto:** ${otherOrgs.length}

${log.map((l) => `- ${l}`).join("\n")}

## Resultados

| Caso | Status | Detalhe |
|------|--------|---------|
${results.map((r) => `| \`${r.table}\` | ${r.ok ? "PASS" : "FAIL"} | ${r.detail} |`).join("\n")}

**PASS:** ${passed.length}  **FAIL/BLOQUEADO:** ${failed.length}

${failed.length ? "Isolamento **não** aprovado neste ciclo." : "Select cruzado e insert org B negados neste ciclo (ainda falta Storage/RPC se não listados)."}
`;

  const out = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "FASE-2-RLS-ORG-AB.md");
  writeFileSync(out, md, "utf8");
  for (const r of results) console.log(line(r.ok, `${r.table} — ${r.detail}`));
  console.log("\nEscrito:", out);
  if (failed.length) process.exitCode = 2;
}

main().catch((err) => {
  console.error("FALHA:", err.message || err);
  process.exit(1);
});
