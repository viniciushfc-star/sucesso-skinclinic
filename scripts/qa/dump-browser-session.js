/**
 * Grava sessão QA em arquivo local (não versionar) para injetar no browser.
 *   node scripts/qa/dump-browser-session.js recepcao
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { escolherOrgComPacientes } from "../../js/utils/golden-flow-auth.js";

const role = String(process.argv[2] || "recepcao").toLowerCase();
const email = String(process.env[`QA_EMAIL_${role.toUpperCase()}`] || "").trim();
const password = String(
  process.env[`QA_PASS_${role.toUpperCase()}`] || process.env.QA_PASS_MASTER || ""
).trim();
const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
if (!email || !password || !url || !anon) {
  console.error("sem credencial", role);
  process.exit(1);
}

const ref = new URL(url).hostname.split(".")[0];
const storageKey = `sb-${ref}-auth-token`;

const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await sb.auth.signInWithPassword({ email, password });
if (error || !data.session) {
  console.error(error?.message || "login falhou");
  process.exit(1);
}
const org = await escolherOrgComPacientes(sb, data.user.id);
const session = {
  access_token: data.session.access_token,
  refresh_token: data.session.refresh_token,
  expires_at: data.session.expires_at,
  expires_in: data.session.expires_in,
  token_type: data.session.token_type || "bearer",
  user: data.session.user,
};
const payload = JSON.stringify(session);
const js = `localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(payload)});
localStorage.setItem("active_org_id", ${JSON.stringify(org.orgId || "")});
true;`;
const out = join(tmpdir(), `sc-qa-${role}.js`);
writeFileSync(out, js, "utf8");
console.log(JSON.stringify({ ok: true, role, orgId: org.orgId, orgRole: org.role, file: out, storageKey }));
