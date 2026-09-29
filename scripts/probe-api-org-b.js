/**
 * POST nas APIs Vercel com JWT + org B. Só imprime status (sem body PII).
 *   node scripts/probe-api-org-b.js
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { credenciaisGoldenAuth } from "../js/utils/golden-flow-auth.js";

async function main() {
  const creds = credenciaisGoldenAuth();
  const service = process.env.SUPABASE_SERVICE_KEY;
  const base = String(process.env.QA_BASE_URL || "https://skinclinic-one.vercel.app").replace(/\/$/, "");
  if (!creds.ok || !service) {
    console.error("faltam credenciais");
    process.exit(2);
  }
  const authRes = await fetch(`${creds.url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: creds.anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  });
  const authJson = await authRes.json();
  const token = authJson.access_token;
  const user = createClient(creds.url, creds.anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(creds.url, service, { auth: { persistSession: false } });
  const { data: mine } = await user.from("organization_users").select("org_id");
  const my = new Set((mine || []).map((m) => m.org_id));
  const own = [...my][0];
  const { data: orgs } = await admin.from("organizations").select("id");
  const victim = (orgs || []).map((o) => o.id).find((id) => !my.has(id));
  const perm = await user.from("organization_user_permissions").select("allowed").limit(1);
  console.log("perm_table", perm.error ? `${perm.error.code} ${perm.error.message}` : `ok n=${(perm.data || []).length}`);

  async function hit(path, json, tok) {
    const apiRes = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(json),
    });
    const text = await apiRes.text();
    console.log(path, tok ? json.org_id === victim ? "orgB" : json.org_id === own ? "orgA" : "tok" : "anon", apiRes.status, text.replace(/\s+/g, " ").slice(0, 120));
  }

  await hit("/api/create-portal-session", { org_id: victim, client_id: "00000000-0000-0000-0000-000000000001" }, null);
  await hit("/api/create-portal-session", { org_id: own, client_id: "00000000-0000-0000-0000-000000000001" }, token);
  await hit("/api/create-portal-session", { org_id: victim, client_id: "00000000-0000-0000-0000-000000000001" }, token);
  await hit("/api/whatsapp-send", { org_id: own, message: "probe" }, token);
  await hit("/api/whatsapp-send", { org_id: victim, message: "probe" }, token);
  await hit("/api/copiloto", { org_id: own, pergunta: "probe rls" }, token);
  await hit("/api/copiloto", { org_id: victim, pergunta: "probe rls" }, token);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
