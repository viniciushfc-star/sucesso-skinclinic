/**
 * Caminho da dona da clínica (JWT anon + RLS). Não WhatsApp, não muda preço.
 *   node scripts/cenario-usuario-clinica.js
 *
 * Credenciais: QA_EMAIL_MASTER / QA_PASS_MASTER no .env
 */
import "dotenv/config";
import { fileURLToPath } from "node:url";
import { resolve as pathResolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { credenciaisGoldenAuth, escolherOrgComPacientes } from "../js/utils/golden-flow-auth.js";
import { classificarSinalRadar } from "../js/utils/crm-fila.js";
import { SETUP_STEP_IDS, proximoPassoSetup } from "../js/utils/golden-flow.js";
import { roteiroUsuarioClinica, withTimeout } from "../js/utils/cenario-usuario.js";

const TIMEOUT_MS = Number(process.env.CENARIO_TIMEOUT_MS || 15000);

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(iso, today = new Date()) {
  if (!iso) return Infinity;
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.floor((today.getTime() - d.getTime()) / 86400000);
}

async function headCount(user, table, orgId) {
  const { count, error } = await user
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (error) throw error;
  return count || 0;
}

export async function runCenariosUsuario(env = process.env) {
  const roteiro = roteiroUsuarioClinica();
  const creds = credenciaisGoldenAuth(env);
  const out = [];
  const mark = (id, estado, detalhe, ms) => {
    const passo = roteiro.find((p) => p.id === id);
    out.push({ id, titulo: passo?.titulo || id, estado, detalhe, ms });
  };

  if (!creds.ok) {
    for (const p of roteiro) {
      mark(p.id, "PULOU", "sem QA_EMAIL_MASTER / QA_PASS_MASTER", 0);
    }
    return { ok: false, pulou: true, passos: out };
  }

  const user = createClient(creds.url, creds.anon, {
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
    return `org ${String(orgId).slice(0, 8)}… · ${org.clientes} pacientes · role ${org.role}`;
  });

  if (!orgId) {
    for (const p of roteiro.filter((x) => x.id !== "login_org")) {
      mark(p.id, "PULOU", "login/org falhou", 0);
    }
    return { ok: false, pulou: false, orgId: null, passos: out };
  }

  await step("hoje_agenda", async () => {
    const { data, error } = await user
      .from("agenda")
      .select("id, data, hora, procedimento, cliente_id, cancelled_at, item_type")
      .eq("org_id", orgId)
      .eq("data", hojeIso())
      .limit(80);
    if (error) throw error;
    const rows = (data || []).filter((r) => !r.cancelled_at);
    return `${rows.length} horário(s) hoje`;
  });

  await step("setup_primeiro_dia", async () => {
    const counts = {};
    for (const [id, table] of [
      ["cliente", "clients"],
      ["agenda", "agenda"],
      ["anamnese", "anamnesis_registros"],
      ["plano", "planos_terapeuticos"],
      ["aplicado", "protocolos_aplicados"],
      ["financeiro", "financeiro"],
    ]) {
      try {
        counts[id] = await headCount(user, table, orgId);
      } catch (e) {
        counts[id] = `erro:${String(e.message || e).slice(0, 40)}`;
      }
    }
    const { data: procs, error: pErr } = await user
      .from("procedures")
      .select("id, valor_cobrado, duration_minutes, custo_material_estimado")
      .eq("org_id", orgId)
      .limit(80);
    if (pErr) throw pErr;
    const temProc = (procs || []).some((p) => Number(p.duration_minutes) > 0 && Number(p.valor_cobrado) > 0);
    const steps = SETUP_STEP_IDS.map((id) => {
      if (id === "procedimento") return { id, ok: temProc };
      if (id === "custo") {
        return {
          id,
          ok: (procs || []).some((p) => Number(p.custo_material_estimado) > 0) || Number(counts.aplicado) > 0,
        };
      }
      if (id === "empresa" || id === "equipe") return { id, ok: true };
      return { id, ok: Number(counts[id] || counts.cliente) > 0 && counts[id] !== undefined ? Number(counts[id]) > 0 : false };
    });
    const next = proximoPassoSetup(steps);
    return `próximo=${next?.id || "nenhum"} · clients=${counts.cliente} agenda=${counts.agenda} aplicado=${counts.aplicado}`;
  });

  await step("radar_retorno", async () => {
    const { data: clients, error: cErr } = await user
      .from("clients")
      .select("id, created_at")
      .eq("org_id", orgId)
      .limit(120);
    if (cErr) throw cErr;
    const { data: agenda, error: aErr } = await user
      .from("agenda")
      .select("cliente_id, data, cancelled_at")
      .eq("org_id", orgId)
      .limit(800);
    if (aErr) throw aErr;
    let pacotes = [];
    const packTry = await user
      .from("client_packages")
      .select("client_id, total_sessoes, sessoes_utilizadas")
      .eq("org_id", orgId)
      .limit(200);
    if (!packTry.error) pacotes = packTry.data || [];
    const today = hojeIso();
    const by = new Map();
    for (const row of agenda || []) {
      if (row.cancelled_at || !row.cliente_id || !row.data) continue;
      const cur = by.get(row.cliente_id) || { visits: 0, lastDate: null, future: false };
      cur.visits += 1;
      if (!cur.lastDate || row.data > cur.lastDate) cur.lastDate = row.data;
      if (row.data >= today) cur.future = true;
      by.set(row.cliente_id, cur);
    }
    const packRest = new Map();
    for (const p of pacotes) {
      const rest = Math.max(0, (p.total_sessoes ?? 0) - (p.sessoes_utilizadas ?? 0));
      packRest.set(p.client_id, (packRest.get(p.client_id) || 0) + rest);
    }
    const tally = {};
    let n = 0;
    for (const c of clients || []) {
      const st = by.get(c.id) || { visits: 0, lastDate: null, future: false };
      const idle = st.lastDate ? daysBetween(st.lastDate) : daysBetween(c.created_at);
      const r = classificarSinalRadar({
        visits: st.visits,
        idleDays: idle,
        hasFuture: st.future,
        packRest: packRest.get(c.id) || 0,
      });
      if (!r.sinal) continue;
      n += 1;
      tally[r.sinal] = (tally[r.sinal] || 0) + 1;
    }
    return `${n} no radar · ${JSON.stringify(tally)}`;
  });

  await step("cliente_vazio", async () => {
    const { data, error } = await user
      .from("clients")
      .select("id, name")
      .eq("org_id", "00000000-0000-0000-0000-000000000000")
      .limit(5);
    if (error) throw error;
    return `lista vazia ok (${(data || []).length}) — RLS não vaza`;
  });

  await step("orcamento_pacote", async () => {
    const o = await user.from("orcamentos").select("id, status").eq("org_id", orgId).limit(20);
    if (o.error && !/does not exist|schema cache/i.test(o.error.message || "")) throw o.error;
    const p = await user.from("client_packages").select("id").eq("org_id", orgId).limit(20);
    const orcN = o.error ? "tabela?" : (o.data || []).length;
    const packN = p.error ? "tabela?" : (p.data || []).length;
    return `orçamentos=${orcN} pacotes=${packN}`;
  });

  await step("espera_opcional", async () => {
    const w = await user.from("agenda_waitlist").select("id").eq("org_id", orgId).limit(10);
    if (w.error) {
      const msg = String(w.error.message || "");
      if (/does not exist|schema cache|org_id/i.test(msg)) {
        return `SQL leftover — não travou (${msg.slice(0, 80)})`;
      }
      throw w.error;
    }
    return `${(w.data || []).length} na espera`;
  });

  const travou = out.some((p) => p.estado === "TRAVOU");
  const falhou = out.some((p) => p.estado === "FALHOU");
  return { ok: !travou && !falhou, pulou: false, orgId, passos: out };
}

function print(resumo) {
  console.log("CENARIO-USUARIO");
  for (const p of resumo.passos) {
    console.log(`${p.estado.padEnd(7)} ${p.ms ?? 0}ms  ${p.id} — ${p.detalhe}`);
  }
  console.log(resumo.ok ? "OK" : resumo.pulou ? "PULOU" : "FALHOU");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === pathResolve(process.argv[1]);

if (isMain) {
  runCenariosUsuario()
    .then((r) => {
      print(r);
      process.exit(r.pulou ? 0 : r.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
