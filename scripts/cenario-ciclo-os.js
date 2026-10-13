/**
 * Cenários Clinic OS ao vivo (JWT + RLS). Só SELECT / RPC de recusa.
 *   node scripts/cenario-ciclo-os.js
 *
 * Humano: o roteiro também imprime o que clicar no painel e no portal.
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { resolve as pathResolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { credenciaisGoldenAuth, escolherOrgComPacientes } from "../js/utils/golden-flow-auth.js";
import { withTimeout } from "../js/utils/cenario-usuario.js";
import { roteiroHumanoCicloOs, roteiroProgramadorCicloOs } from "../js/utils/cenario-ciclo-os.js";

const TIMEOUT_MS = Number(process.env.CENARIO_TIMEOUT_MS || 15000);

export async function runCenariosCicloOs(env = process.env) {
  const roteiro = roteiroProgramadorCicloOs();
  const creds = credenciaisGoldenAuth(env);
  const out = [];
  const mark = (id, estado, detalhe, ms) => {
    const passo = roteiro.find((p) => p.id === id);
    out.push({ id, titulo: passo?.titulo || id, estado, detalhe, ms });
  };

  if (!creds.ok) {
    for (const p of roteiro) mark(p.id, "PULOU", "sem QA_EMAIL_MASTER / QA_PASS_MASTER", 0);
    return { ok: false, pulou: true, passos: out };
  }

  const user = createClient(creds.url, creds.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(creds.url, creds.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let orgId = null;

  async function step(id, fn) {
    const t0 = Date.now();
    try {
      const detalhe = await withTimeout(fn(), TIMEOUT_MS, id);
      mark(id, "OK", detalhe || "", Date.now() - t0);
    } catch (err) {
      const msg = String(err?.message || err);
      const trava = /^TRAVOU:/.test(msg);
      mark(id, trava ? "TRAVOU" : "FALHOU", msg.slice(0, 280), Date.now() - t0);
    }
  }

  await step("login_org", async () => {
    const { data, error } = await user.auth.signInWithPassword({
      email: creds.email,
      password: creds.password,
    });
    if (error) throw error;
    if (!data?.session?.access_token) throw new Error("sem JWT");
    const org = await escolherOrgComPacientes(user);
    if (!org.ok) throw new Error(org.detalhe || "sem org");
    orgId = org.orgId;
    return `org ${String(orgId).slice(0, 8)}… · ${org.clientes} pacientes`;
  });

  if (!orgId) {
    for (const p of roteiro.filter((x) => x.id !== "login_org")) {
      mark(p.id, "PULOU", "login/org falhou", 0);
    }
    return { ok: false, pulou: false, orgId: null, passos: out };
  }

  await step("sql_quem_vendeu", async () => {
    const { data, error } = await user
      .from("agenda")
      .select("id, user_id, sold_by_user_id")
      .eq("org_id", orgId)
      .limit(20);
    if (error) {
      const m = String(error.message || "");
      if (/sold_by_user_id|schema cache|column/i.test(m)) {
        throw new Error("Falta sold_by_user_id — rode supabase-fase0-quem-vendeu-colar.sql");
      }
      throw error;
    }
    const rows = data || [];
    const split = rows.filter((r) => r.sold_by_user_id && r.sold_by_user_id !== r.user_id).length;
    return `${rows.length} horário(s) · ${split} com vendeu ≠ aplica`;
  });

  await step("sql_portal_login", async () => {
    const { error } = await anon.rpc("login_client_portal", {
      p_email: "naoexiste@example.com",
      p_password: "12345678",
    });
    const msg = String(error?.message || error?.code || "");
    if (/does not exist|42883|schema cache/i.test(msg)) {
      throw new Error("Falta RPC — rode supabase-fase0-portal-login-colar.sql");
    }
    if (!/conferem|Clinica|clinica/i.test(msg)) {
      throw new Error(`RPC inesperado: ${msg.slice(0, 120)}`);
    }
    return "RPC recusou senha/e-mail falso (não é Auth da equipe)";
  });

  await step("staff_nao_le_hash", async () => {
    const { data, error } = await user.from("client_portal_logins").select("password_hash").limit(1);
    if (error) {
      const m = String(error.message || "");
      if (/permission|42501|row-level|does not exist|schema cache/i.test(m)) {
        return `hash protegido (${m.slice(0, 60)})`;
      }
      throw error;
    }
    if ((data || []).some((r) => r.password_hash)) {
      throw new Error("TRAVOU: staff leu password_hash");
    }
    return "SELECT sem hash visível";
  });

  await step("ficha_ciclo_live", async () => {
    const { data: clients, error } = await user
      .from("clients")
      .select("id, name")
      .eq("org_id", orgId)
      .limit(5);
    if (error) throw error;
    const c = (clients || [])[0];
    if (!c) return "sem paciente para ler ciclo";
    const { data: ap, error: apErr } = await user
      .from("protocolos_aplicados")
      .select("id, descricao, protocolo_id, agenda_id")
      .eq("org_id", orgId)
      .eq("client_id", c.id)
      .limit(10);
    if (apErr && !/does not exist|schema cache/i.test(apErr.message || "")) throw apErr;
    return `${c.name || "paciente"} · aplicados=${(ap || []).length}`;
  });

  const travou = out.some((p) => p.estado === "TRAVOU");
  const falhou = out.some((p) => p.estado === "FALHOU");
  return { ok: !travou && !falhou, pulou: false, orgId, passos: out };
}

function print(resumo) {
  console.log("ROTEIRO HUMANO (clique no app)");
  for (const h of roteiroHumanoCicloOs()) {
    console.log(`  [${h.ator}] ${h.id} — ${h.titulo}`);
    console.log(`           ${h.como}`);
  }
  console.log("CENARIO-CICLO-OS");
  for (const p of resumo.passos) {
    console.log(`${p.estado.padEnd(7)} ${p.ms ?? 0}ms  ${p.id} — ${p.detalhe}`);
  }
  console.log(resumo.ok ? "OK" : resumo.pulou ? "PULOU" : "FALHOU");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === pathResolve(process.argv[1]);

if (isMain) {
  runCenariosCicloOs()
    .then((r) => {
      print(r);
      process.exit(r.pulou ? 0 : r.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
