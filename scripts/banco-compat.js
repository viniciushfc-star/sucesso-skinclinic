/**
 * Compatibilidade do banco com o app + tabelas gêmeas.
 * Lê Git (js/routes/lib + supabase/*.sql) e o live (PostgREST + OpenAPI).
 * Não altera o banco. Não imprime secrets.
 *
 *   npm run banco:compat
 *   node scripts/banco-compat.js --json
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PARES_DUPLICADOS,
  TABELAS_NUCLEO,
  classificarErroTabela,
  extrairCreateTable,
  extrairFrom,
  extrairRpc,
  interpretarPar,
  rpcsOpenApi,
  tabelasOpenApi,
  veredicto,
} from "../js/utils/banco-compat.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const JSON_OUT = process.argv.includes("--json");

function walk(dir, acc = []) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".git" || name === "preview") continue;
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function lerApp() {
  const from = new Set();
  const create = new Set();
  const rpc = new Set();
  const appDirs = [join(ROOT, "js"), join(ROOT, "routes"), join(ROOT, "lib")];
  for (const dir of appDirs) {
    for (const p of walk(dir)) {
      if (!/\.(js|mjs|cjs)$/.test(p)) continue;
      const src = readFileSync(p, "utf8");
      for (const t of extrairFrom(src)) from.add(t);
      for (const t of extrairRpc(src)) rpc.add(t);
    }
  }
  for (const p of walk(join(ROOT, "supabase"))) {
    if (!/\.sql$/i.test(p)) continue;
    const src = readFileSync(p, "utf8");
    for (const t of extrairCreateTable(src)) create.add(t);
  }
  return {
    app: [...from].sort(),
    sql: [...create].sort(),
    rpc: [...rpc].sort(),
  };
}

async function openApiSpec(url, key) {
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/openapi+json",
    },
  });
  if (!res.ok) throw new Error(`OpenAPI HTTP ${res.status}`);
  return res.json();
}

async function probeTabela(admin, table) {
  const { error, count } = await admin.from(table).select("*", { head: true, count: "exact" }).limit(0);
  return {
    table,
    status: classificarErroTabela(error),
    count: error ? null : count,
    detalhe: error?.message || "",
  };
}

async function overlapIds(admin, a, b) {
  const { data: da, error: ea } = await admin.from(a).select("id").limit(4000);
  const { data: db, error: eb } = await admin.from(b).select("id").limit(4000);
  if (ea || eb) return { overlap: null, detalhe: ea?.message || eb?.message || "" };
  const A = new Set((da || []).map((r) => r.id).filter(Boolean));
  let n = 0;
  for (const r of db || []) if (r.id && A.has(r.id)) n += 1;
  return { overlap: n, detalhe: "" };
}

function linha(cols) {
  return cols.map((c) => String(c ?? "")).join("\t");
}

export async function diagnosticarBanco(env = process.env) {
  const git = lerApp();
  const url = String(env.SUPABASE_URL || "").trim();
  const key = String(env.SUPABASE_SERVICE_KEY || "").trim();
  const rel = {
    quando: new Date().toISOString(),
    host: "",
    git,
    live: [],
    openapi: { tabelas: [], rpcs: [], erro: "" },
    pares: [],
    extraLive: [],
    sqlSemApp: [],
    appSemSql: [],
    nucleoFaltando: [],
    appFaltando: [],
    veredicto: "PARCIAL",
  };

  const esperado = new Set([...git.app, ...git.sql, ...TABELAS_NUCLEO, ...PARES_DUPLICADOS.flatMap((p) => [p.canon, p.legado])]);

  if (!url || !key) {
    rel.veredicto = "SEM_CREDENCIAL";
    rel.sqlSemApp = git.sql.filter((t) => !git.app.includes(t));
    rel.appSemSql = git.app.filter((t) => !git.sql.includes(t));
    return rel;
  }

  rel.host = new URL(url).host;
  const admin = createClient(url, key, { auth: { persistSession: false } });

  try {
    const spec = await openApiSpec(url, key);
    rel.openapi.tabelas = tabelasOpenApi(spec);
    rel.openapi.rpcs = rpcsOpenApi(spec);
    for (const t of rel.openapi.tabelas) esperado.add(t);
  } catch (e) {
    rel.openapi.erro = String(e.message || e);
  }

  const lista = [...esperado].sort();
  const lote = 8;
  for (let i = 0; i < lista.length; i += lote) {
    const chunk = lista.slice(i, i + lote);
    rel.live.push(...(await Promise.all(chunk.map((table) => probeTabela(admin, table)))));
  }

  const byName = Object.fromEntries(rel.live.map((r) => [r.table, r]));

  for (const par of PARES_DUPLICADOS) {
    const canon = byName[par.canon] || { status: "AUSENTE", count: null };
    const legado = byName[par.legado] || { status: "AUSENTE", count: null };
    let extra = {};
    if (canon.status === "EXISTE" && legado.status === "EXISTE") {
      extra = await overlapIds(admin, par.canon, par.legado);
    }
    const interp = interpretarPar(canon, legado, extra);
    rel.pares.push({
      ...par,
      canonStatus: canon.status,
      canonCount: canon.count,
      legadoStatus: legado.status,
      legadoCount: legado.count,
      overlap: extra.overlap ?? null,
      ...interp,
    });
  }

  rel.nucleoFaltando = TABELAS_NUCLEO.filter((t) => byName[t]?.status !== "EXISTE");
  rel.appFaltando = git.app.filter((t) => {
    const st = byName[t]?.status;
    return st && st !== "EXISTE" && st !== "BLOQUEADO";
  });
  const liveNomes = new Set(
    (rel.openapi.tabelas.length ? rel.openapi.tabelas : rel.live.filter((r) => r.status === "EXISTE").map((r) => r.table))
  );
  rel.extraLive = [...liveNomes].filter((t) => !git.app.includes(t) && !git.sql.includes(t)).sort();
  rel.sqlSemApp = git.sql.filter((t) => !git.app.includes(t));
  rel.appSemSql = git.app.filter((t) => !git.sql.includes(t));
  const paresProblema = rel.pares.filter((p) => p.nivel === "FALTA" || p.nivel === "ATENCAO");
  rel.veredicto = veredicto({
    nucleoFaltando: rel.nucleoFaltando,
    paresProblema,
    appFaltando: rel.appFaltando,
  });
  return rel;
}

function imprimir(rel) {
  console.log(`# Banco × app  ${rel.quando.slice(0, 19)}`);
  console.log(rel.host ? `host: ${rel.host}` : "host: (sem SUPABASE_URL / SERVICE_KEY — só inventário Git)");
  console.log(`veredicto: ${rel.veredicto}`);
  console.log("");
  console.log(`Git app .from(): ${rel.git.app.length}  SQL CREATE: ${rel.git.sql.length}  RPC no código: ${rel.git.rpc.length}`);
  if (rel.nucleoFaltando.length) {
    console.log("\nNÚCLEO AUSENTE (app não sobe direito):");
    for (const t of rel.nucleoFaltando) console.log("  -", t);
  }
  if (rel.appFaltando.length) {
    console.log("\nTABELA QUE O APP CHAMA E NÃO EXISTE:");
    for (const t of rel.appFaltando) console.log("  -", t);
  }
  console.log("\nPARES DUPLICADOS");
  console.log(linha(["par", "canônico n", "legado n", "ids nas duas", "nível", "ação"]));
  for (const p of rel.pares) {
    console.log(
      linha([
        `${p.canon} / ${p.legado}`,
        p.canonStatus === "EXISTE" ? p.canonCount : p.canonStatus,
        p.legadoStatus === "EXISTE" ? p.legadoCount : p.legadoStatus,
        p.overlap == null ? "—" : p.overlap,
        p.nivel,
        p.acao,
      ])
    );
  }
  const limpar = rel.pares.filter((p) => p.limpar);
  if (limpar.length) {
    console.log("\nCandidatos a limpeza (legado vazio). Backup antes. Este script não apaga nada:");
    for (const p of limpar) console.log(`  - public.${p.legado} (gêmeo de ${p.canon})`);
  }
  if (rel.extraLive.length) {
    console.log("\nNO LIVE E NÃO APARECE NO APP NEM NO SQL DO GIT:");
    for (const t of rel.extraLive) console.log("  -", t);
  }
  if (rel.sqlSemApp.length) {
    console.log("\nCREATE NO GIT SEM .from() NO APP (SQL leftover ou tabela só de RPC):");
    for (const t of rel.sqlSemApp) console.log("  -", t);
  }
  if (rel.appSemSql.length) {
    console.log("\nAPP CHAMA E NÃO HÁ CREATE NO GIT (pode viver só no live):");
    for (const t of rel.appSemSql) console.log("  -", t);
  }
  if (rel.openapi.erro) console.log("\nOpenAPI:", rel.openapi.erro);
  console.log("\nSQL de conferência no Editor: supabase/supabase-fase0-banco-compat-colar.sql");
  console.log("Nada foi alterado no banco.");
}

async function main() {
  const rel = await diagnosticarBanco();
  if (JSON_OUT) {
    console.log(JSON.stringify(rel, null, 2));
    return;
  }
  imprimir(rel);
  if (rel.veredicto === "INCOMPATIVEL" || rel.veredicto === "SEM_CREDENCIAL") process.exitCode = rel.veredicto === "INCOMPATIVEL" ? 2 : 0;
}

const invoked = String(process.argv[1] || "").replace(/\\/g, "/").endsWith("banco-compat.js");
if (invoked) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
