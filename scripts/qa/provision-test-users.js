/**
 * Cria funcionário e gestor com alias Gmail (mesmo e-mail +tag).
 * Precisa de SUPABASE_SERVICE_KEY (Dashboard → Settings → API → service_role)
 * ou cadastro por e-mail ligado.
 *
 *   node scripts/qa/provision-test-users.js
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function plusAlias(email, tag) {
  const e = String(email || "").trim();
  const at = e.indexOf("@");
  if (at < 1) throw new Error("QA_EMAIL_MASTER inválido");
  const local = e.slice(0, at).replace(/\+.*$/, "");
  return `${local}+${tag}${e.slice(at)}`;
}

function upsertEnv(file, pairs) {
  let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (text.length && !text.endsWith("\n")) text += "\n";
  for (const [key, value] of Object.entries(pairs)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(text)) text = text.replace(re, line);
    else text += `${line}\n`;
  }
  fs.writeFileSync(file, text, "utf8");
}

async function inviteAndJoin(anon, orgId, email, password, role) {
  const { data: loginMaster } = await anon.auth.getUser();
  if (!loginMaster?.user) throw new Error("Sessão master perdida");

  const { error: invErr } = await anon.from("organization_invites").insert({
    org_id: orgId,
    email: email.toLowerCase(),
    role,
    status: "pending",
    token: randomBytes(24).toString("hex"),
  });
  if (invErr && !/duplicate|23505/i.test(invErr.message || "")) {
    throw new Error("Convite: " + invErr.message);
  }

  let joined;
  const firstLogin = await anon.auth.signInWithPassword({ email, password });
  if (firstLogin.data?.user) {
    joined = firstLogin.data;
  } else {
    const { error: signErr } = await anon.auth.signUp({ email, password });
    const signMsg = String(signErr?.message || "");
    if (signErr && /rate limit/i.test(signMsg)) {
      throw new Error("RATE_LIMIT " + email + ": " + signMsg);
    }
    if (signErr && !/already|registered|exists/i.test(signMsg)) {
      throw new Error(
        "Não deu para criar " +
          email +
          ": " +
          signMsg +
          ". Ligue o cadastro por e-mail no Auth ou coloque SUPABASE_SERVICE_KEY no .env."
      );
    }
    const second = await anon.auth.signInWithPassword({ email, password });
    if (second.error || !second.data?.user) {
      throw new Error(
        "Login " +
          role +
          " (" +
          email +
          "): " +
          (second.error?.message || signMsg || firstLogin.error?.message || "falhou") +
          ". Se o cadastro acabou de ocorrer, rode supabase/supabase-qa-confirm-test-users.sql e execute o script de novo."
      );
    }
    joined = second.data;
  }

  const { error: linkErr } = await anon.from("organization_users").insert({
    org_id: orgId,
    user_id: joined.user.id,
    role,
  });
  if (linkErr && !/duplicate|23505/i.test(linkErr.message || "")) {
    throw new Error("Vínculo " + role + ": " + linkErr.message);
  }

  await anon.from("organization_invites").update({ status: "accepted" }).eq("org_id", orgId).ilike("email", email);
}

async function findUserId(admin, email) {
  const needle = email.toLowerCase();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = (data.users || []).find((u) => String(u.email || "").toLowerCase() === needle);
    if (hit) return hit.id;
    if (!data.users?.length || data.users.length < 200) return null;
    page += 1;
    if (page > 20) return null;
  }
}

async function ensureUser(admin, anon, email, password) {
  if (admin) {
    const existing = await findUserId(admin, email);
    if (existing) {
      await admin.auth.admin.updateUserById(existing, { password, email_confirm: true });
      return existing;
    }
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: email },
    });
    if (error) throw error;
    return data.user.id;
  }

  const { data, error } = await anon.auth.signUp({ email, password });
  if (error) throw error;
  if (data.user?.identities && data.user.identities.length === 0) {
    throw new Error(`E-mail já existe e o cadastro público não recria: ${email}`);
  }
  return data.user?.id;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const masterEmail = process.env.QA_EMAIL_MASTER;
  const password = process.env.QA_PASS_MASTER;
  if (!url || !anonKey || !masterEmail || !password) {
    throw new Error("Falta SUPABASE_URL, SUPABASE_ANON_KEY, QA_EMAIL_MASTER ou QA_PASS_MASTER no .env");
  }

  const envPath = path.join(process.cwd(), ".env");

  const anon = createClient(url, anonKey);
  const admin = serviceKey ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;

  const { data: session, error: loginErr } = await anon.auth.signInWithPassword({
    email: masterEmail,
    password,
  });
  if (loginErr || !session.user) throw new Error("Login master falhou: " + (loginErr?.message || "sem sessão"));

  const { data: memberships, error: memErr } = await anon
    .from("organization_users")
    .select("org_id, role")
    .eq("user_id", session.user.id);
  if (memErr) throw memErr;
  let orgId = memberships?.[0]?.org_id;

  if (!orgId) {
    const { data: org, error: orgErr } = await anon
      .from("organizations")
      .insert({ name: "Clínica QA", owner_id: session.user.id })
      .select("id")
      .single();
    if (orgErr) throw new Error("Não foi possível criar a clínica: " + orgErr.message);
    const { error: linkErr } = await anon.from("organization_users").insert({
      org_id: org.id,
      user_id: session.user.id,
      role: "master",
    });
    if (linkErr) throw new Error("Não foi possível vincular o master: " + linkErr.message);
    orgId = org.id;
    console.log("Clínica QA criada para o master.");
  }

  const funcEmail = plusAlias(masterEmail, "funcionario");
  const gestCandidates = [plusAlias(masterEmail, "gestor"), plusAlias(masterEmail, "gestorqa")];

  if (!admin) {
    console.log("Sem SUPABASE_SERVICE_KEY: tentando cadastro público (pode estar desligado).");
  }

  if (admin) {
    const funcId = await ensureUser(admin, anon, funcEmail, password);
    const gestId = await ensureUser(admin, anon, gestCandidates[0], password);
    const rows = [
      { org_id: orgId, user_id: funcId, role: "staff" },
      { org_id: orgId, user_id: gestId, role: "gestor" },
    ];
    for (const row of rows) {
      const { error } = await admin.from("organization_users").upsert(row, {
        onConflict: "org_id,user_id",
      });
      if (error) {
        const { error: insErr } = await admin.from("organization_users").insert(row);
        if (insErr && !/duplicate|23505/i.test(insErr.message || "")) throw insErr;
      }
    }
  } else {
    await inviteAndJoin(anon, orgId, funcEmail, password, "staff");
    upsertEnv(envPath, {
      QA_RUN_AUTH: "1",
      QA_EMAIL_FUNCIONARIO: funcEmail,
      QA_PASS_FUNCIONARIO: password,
    });
    console.log("funcionario ok", funcEmail);

    async function reloginMaster() {
      const { error: reloginErr } = await anon.auth.signInWithPassword({
        email: masterEmail,
        password,
      });
      if (reloginErr) throw new Error("Relogin master: " + reloginErr.message);
    }

    await reloginMaster();
    let gestEmailUsed = null;
    for (const candidate of gestCandidates) {
      try {
        await inviteAndJoin(anon, orgId, candidate, password, "gestor");
        gestEmailUsed = candidate;
        break;
      } catch (e) {
        const msg = String(e.message || e);
        console.warn("gestor", candidate, msg);
        if (!/RATE_LIMIT|Invalid login/i.test(msg)) throw e;
      }
    }
    if (!gestEmailUsed) {
      throw new Error(
        "Não criou o gestor: o Auth está limitando cadastros. Espere alguns minutos ou coloque SUPABASE_SERVICE_KEY no .env (Dashboard → Settings → API → service_role) e rode o script de novo."
      );
    }
    gestCandidates[0] = gestEmailUsed;
  }
  const gestEmail = gestCandidates[0];
  upsertEnv(envPath, {
    QA_RUN_AUTH: "1",
    QA_EMAIL_FUNCIONARIO: funcEmail,
    QA_PASS_FUNCIONARIO: password,
    QA_EMAIL_GESTOR: gestEmail,
    QA_PASS_GESTOR: password,
    QA_ORG_ID: orgId,
  });

  console.log("OK org", orgId);
  console.log("funcionario", funcEmail);
  console.log("gestor", gestEmail);
  console.log("Senha: a mesma do master (QA_PASS_MASTER).");
}

main().catch((e) => {
  console.error("FALHA:", e.message || e);
  process.exit(1);
});
