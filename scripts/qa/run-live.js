/**
 * Bateria ao vivo contra a Vercel (e opcionalmente 3 logins).
 *   node scripts/qa/run-live.js
 * Env: QA_BASE_URL, QA_EMAIL_*, QA_PASS_*, SUPABASE_URL, SUPABASE_ANON_KEY
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildCatalog, BASE_DEFAULT, catalogStats } from "./catalog.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASE = String(process.env.QA_BASE_URL || BASE_DEFAULT).replace(/\/$/, "");
const DELAY_MS = Number(process.env.QA_DELAY_MS || 40);
const RUN_AUTH = process.env.QA_RUN_AUTH === "1";
const LIVE_AI = process.env.QA_LIVE_AI === "1";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function statusOk(got, allowed) {
  if (!allowed || !allowed.length) return got >= 200 && got < 500;
  return allowed.includes(got);
}

async function loginRole(role) {
  const email = process.env[`QA_EMAIL_${role.toUpperCase()}`];
  const password = process.env[`QA_PASS_${role.toUpperCase()}`];
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!email || !password || !url || !anon) return null;
  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(`login ${role} falhou: ${json.error_description || json.msg || res.status}`);
  }
  return json.access_token;
}

async function probe(c, tokens) {
  const url = BASE + (c.path.startsWith("http") ? "" : c.path);
  const headers = { ...(c.headers || {}) };
  if (c.origin) headers.Origin = c.origin;
  if (c.json !== undefined) headers["Content-Type"] = "application/json";
  if (c.contentType) headers["Content-Type"] = c.contentType;
  if (c.role && tokens[c.role]) headers.Authorization = `Bearer ${tokens[c.role]}`;

  let body;
  if (c.rawBody !== undefined) body = c.rawBody;
  else if (c.json !== undefined) body = JSON.stringify(c.json);

  const res = await fetch(url, { method: c.method || "GET", headers, body, redirect: "manual" });
  const acao = res.headers.get("access-control-allow-origin");

  if (c.live === "cors") {
    if (c.expectNoAllowOrigin) {
      if (acao && acao === c.origin) {
        return { ok: false, detail: `ACAO ecoou ${acao}` };
      }
      return { ok: true, detail: `status ${res.status} acao=${acao || "(vazio)"}` };
    }
    return { ok: true, detail: `status ${res.status} acao=${acao || "(vazio)"}` };
  }

  if (c.live === "anon-header") {
    if (c.optionalHeader) {
      const v = res.headers.get(c.header);
      if (!v) return { ok: true, warn: `header ${c.header} ausente`, detail: String(res.status) };
      const match = !c.headerValue || String(v).toLowerCase().includes(c.headerValue);
      return { ok: match, detail: `${c.header}=${v}` };
    }
  }

  if (c.expectForbidden) {
    const ok = res.status === 403 || res.status === 401;
    return { ok, detail: `status ${res.status}` };
  }

  if (c.expectStatus) {
    return { ok: statusOk(res.status, c.expectStatus), detail: `status ${res.status}` };
  }

  return { ok: res.status < 500, detail: `status ${res.status}` };
}

function shouldRun(c, tokens) {
  if (c.live === "none" || c.live === "manual-or-ui" || c.live === "auth-ui") return "skip";
  if (c.live === "anon" || c.live === "anon-light" || c.live === "cors" || c.live === "anon-header") return "run";
  if (c.live === "auth-api") {
    if (!RUN_AUTH) return "skip";
    if (!tokens[c.role]) return "skip";
    if (c.skipUnlessLive && !LIVE_AI) {
      if (c.expectForbidden) return "run";
      return "skip";
    }
    return "run";
  }
  return "skip";
}

async function main() {
  const catalog = buildCatalog();
  const stats = catalogStats(catalog);
  const tokens = {};
  const results = [];
  let fail = 0;
  let pass = 0;
  let skip = 0;
  let warn = 0;

  if (RUN_AUTH) {
    for (const role of ["funcionario", "gestor", "master"]) {
      try {
        tokens[role] = await loginRole(role);
        if (!tokens[role]) {
          console.warn(`[QA] sem credencial completa para ${role} (QA_EMAIL_${role.toUpperCase()} / QA_PASS_*)`);
        } else {
          console.log(`[QA] sessão ${role} ok`);
        }
      } catch (e) {
        console.warn(`[QA] login ${role}:`, e.message);
      }
    }
  }

  for (const c of catalog) {
    const mode = shouldRun(c, tokens);
    if (mode === "skip") {
      skip += 1;
      results.push({ id: c.id, skip: true, title: c.title });
      continue;
    }
    try {
      const r = await probe(c, tokens);
      if (r.warn) warn += 1;
      if (r.ok) pass += 1;
      else fail += 1;
      results.push({ id: c.id, ok: r.ok, warn: r.warn || null, detail: r.detail, title: c.title });
      if (!r.ok) console.log("FAIL", c.id, r.detail, c.title);
    } catch (e) {
      fail += 1;
      results.push({ id: c.id, ok: false, detail: String(e.message || e), title: c.title });
      console.log("FAIL", c.id, e.message);
    }
    await sleep(DELAY_MS);
  }

  const report = {
    base: BASE,
    at: new Date().toISOString(),
    catalog: stats.total,
    ran: pass + fail,
    pass,
    fail,
    skip,
    warn,
    families: stats.byFamily,
    failures: results.filter((r) => r.ok === false),
  };
  const out = path.join(ROOT, "scripts", "qa-last-report.json");
  writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ ...report, failures: report.failures.length }, null, 2));
  console.log("Relatório:", out);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
