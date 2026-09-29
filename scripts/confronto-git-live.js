/**
 * Confronta o que o Git espera com o projeto Supabase live (PostgREST).
 * Service role: existência/contagem/colunas/RPC. JWT master: SELECT por org.
 * Não grava. Não imprime secrets.
 *
 *   node scripts/confronto-git-live.js
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { elosGoldenParaLeitura, interpretarLeituraElo, credenciaisGoldenAuth, escolherOrgComPacientes } from "../js/utils/golden-flow-auth.js";
import { PORTAL_RPCS, interpretarRpcPortal } from "../js/utils/rls-prova.js";

const TABLES = [
  "organizations",
  "organization_users",
  "organization_invites",
  "organization_user_permissions",
  "organization_access_requests",
  "organization_legal_documents",
  "profiles",
  "clients",
  "clientes",
  "client_events",
  "client_sessions",
  "client_records",
  "client_protocols",
  "client_packages",
  "package_consumptions",
  "client_evolution_photos",
  "agenda",
  "appointments",
  "agenda_config",
  "agenda_waitlist",
  "appointment_confirmations",
  "external_calendar_blocks",
  "salas",
  "procedures",
  "procedure_categories",
  "procedure_stock_usage",
  "professional_procedures",
  "planos_terapeuticos",
  "planos_terapeuticos_procedimentos",
  "protocolos",
  "protocolos_descartaveis",
  "protocolos_aplicados",
  "estoque_entradas",
  "estoque_consumo",
  "estoque_produtos",
  "sugestoes_estoque",
  "financeiro",
  "contas_a_pagar",
  "financeiro_metas",
  "participacao_lucros",
  "contas_vinculadas",
  "fiscal_documents",
  "fiscal_apuracoes",
  "anamnesis_funcoes",
  "anamnesis_registros",
  "analise_pele",
  "skincare_rotinas",
  "estudo_casos",
  "notificacoes",
  "message_templates",
  "conteudo_calendario",
  "whatsapp_logs",
  "audit_logs",
  "logs",
  "afazeres",
  "team_payment_models",
  "copiloto_chat",
  "precificacao_ia",
  "marketing_ia",
  "protocolos_ia",
  "ai_usage_events",
  "api_error_events",
  "lgpd_requests",
  "ocr_notas",
  "market_radar_refs",
  "agenda_google_events",
  "google_calendar_connections",
  "assinaturas",
  "convites",
  "orcamentos",
];

const CORE = new Set([
  "organizations",
  "organization_users",
  "organization_user_permissions",
  "clients",
  "agenda",
  "procedures",
  "financeiro",
  "audit_logs",
]);

const LEGACY = new Set(["appointments", "clientes", "convites", "logs", "assinaturas"]);

/** Pares tabela.coluna que o código/Git usa. */
const COLUNAS = [
  { table: "agenda", col: "cancelled_at", git: "cancelamento" },
  { table: "agenda", col: "arrived_at", git: "sala espera" },
  { table: "agenda", col: "started_at", git: "sala espera" },
  { table: "agenda", col: "confirmed_at", git: "confirmacao" },
  { table: "agenda", col: "plano_id", git: "plano na agenda" },
  { table: "agenda", col: "sessao_plano", git: "plano na agenda" },
  { table: "agenda", col: "sessoes_plano", git: "plano na agenda" },
  { table: "agenda", col: "reminder_sent_at", git: "lembrete" },
  { table: "clients", col: "legacy_cliente_id", git: "merge clientes" },
  { table: "clients", col: "lgpd_erased_at", git: "LGPD" },
  { table: "clients", col: "consent_terms_accepted_at", git: "consentimento" },
  { table: "client_sessions", col: "token_hash", git: "portal" },
  { table: "client_sessions", col: "revoked_at", git: "portal" },
  { table: "client_packages", col: "orcamento_id", git: "ciclo ouro" },
  { table: "package_consumptions", col: "agenda_id", git: "baixa pacote" },
  { table: "orcamentos", col: "status", git: "orcamentos" },
  { table: "orcamentos", col: "items", git: "orcamentos" },
  { table: "estoque_produtos", col: "quantidade_minima", git: "lotes" },
  { table: "estoque_consumo", col: "lote", git: "lotes" },
  { table: "estoque_consumo", col: "motivo", git: "lotes" },
  { table: "organizations", col: "rateio_metodo", git: "rateio" },
  { table: "organizations", col: "cidade", git: "org perfil" },
  { table: "organizations", col: "nota_fiscal_emitir_url", git: "NFS URL avulso" },
  { table: "financeiro", col: "webhook_event_id", git: "webhook" },
  { table: "audit_logs", col: "acknowledged_at", git: "auditoria" },
  { table: "google_calendar_connections", col: "granted_scopes", git: "google" },
  { table: "google_calendar_connections", col: "reconnect_needed", git: "google" },
  { table: "analise_pele", col: "ia_preliminar", git: "pele interno" },
  { table: "analise_pele", col: "texto_validado", git: "pele portal" },
  { table: "client_events", col: "event_type", git: "CRM eventos" },
];

const BUCKETS = ["analise-pele-fotos", "client-photos", "anamnese-fotos", "org-logos"];

function classificarTabela(error) {
  if (!error) return "EXISTE";
  const code = String(error.code || "");
  const msg = String(error.message || "");
  if (code === "PGRST205" || /could not find the table|schema cache|does not exist/i.test(msg)) return "AUSENTE";
  if (code === "42501" || /permission denied|row-level security/i.test(msg)) return "BLOQUEADO";
  return `ERRO:${code || msg.slice(0, 60)}`;
}

function classificarColuna(error) {
  if (!error) return "OK";
  const msg = String(error.message || "");
  if (/schema cache|column|does not exist|42703/i.test(msg) || error.code === "PGRST204") return "COLUNA_AUSENTE";
  if (classificarTabela(error) === "AUSENTE") return "TABELA_AUSENTE";
  return `ERRO:${error.code || msg.slice(0, 80)}`;
}

export async function confrontarLive(env = process.env) {
  const url = String(env.SUPABASE_URL || "").trim();
  const service = String(env.SUPABASE_SERVICE_KEY || "").trim();
  const creds = credenciaisGoldenAuth(env);
  const relatorio = {
    quando: new Date().toISOString(),
    host: url ? new URL(url).host : "",
    tabelas: [],
    colunas: [],
    rpcs: [],
    buckets: [],
    jwt: null,
    agendaFk: null,
  };

  if (!url || !service) {
    return { ok: false, skip: "sem SUPABASE_URL ou SUPABASE_SERVICE_KEY", relatorio };
  }

  const admin = createClient(url, service, { auth: { persistSession: false } });

  for (const table of TABLES) {
    const { error, count } = await admin.from(table).select("*", { head: true, count: "exact" }).limit(0);
    const status = classificarTabela(error);
    relatorio.tabelas.push({
      table,
      status,
      count: status === "EXISTE" ? count : null,
      core: CORE.has(table),
      legacy: LEGACY.has(table),
      detalhe: error?.message || "",
    });
  }

  for (const c of COLUNAS) {
    const { error } = await admin.from(c.table).select(c.col).limit(1);
    relatorio.colunas.push({
      table: c.table,
      git: c.git,
      cols: c.col,
      status: classificarColuna(error),
      detalhe: error?.message || "",
    });
  }

  for (const fn of PORTAL_RPCS) {
    const { data, error } = await admin.rpc(fn, { p_token: "confronto-token-lixo" });
    const leitura = interpretarRpcPortal({ data, error });
    relatorio.rpcs.push({
      fn,
      ok: leitura.ok,
      detalhe: leitura.detalhe,
      code: error?.code || "",
      msg: error?.message || "",
    });
  }

  try {
    const { data: bucks, error: bErr } = await admin.storage.listBuckets();
    if (bErr) {
      relatorio.buckets.push({ name: "_list", status: "ERRO", detalhe: bErr.message });
    } else {
      const names = new Set((bucks || []).map((b) => b.name));
      for (const name of BUCKETS) {
        relatorio.buckets.push({
          name,
          status: names.has(name) ? "EXISTE" : "AUSENTE",
          public: (bucks || []).find((b) => b.name === name)?.public ?? null,
        });
      }
    }
  } catch (e) {
    relatorio.buckets.push({ name: "_list", status: "ERRO", detalhe: String(e.message || e) });
  }

  const { data: ag } = await admin.from("agenda").select("id, cliente_id, org_id").limit(30);
  const ids = [...new Set((ag || []).map((r) => r.cliente_id).filter(Boolean))];
  if (ids.length) {
    const { data: inClients } = await admin.from("clients").select("id").in("id", ids);
    const { data: inClientes, error: eLeg } = await admin.from("clientes").select("id").in("id", ids);
    relatorio.agendaFk = {
      agendaAmostra: (ag || []).length,
      ids: ids.length,
      emClients: (inClients || []).length,
      emClientes: eLeg ? null : (inClientes || []).length,
      clientesErro: eLeg?.message || "",
    };
  } else {
    relatorio.agendaFk = { agendaAmostra: (ag || []).length, ids: 0, emClients: 0, emClientes: 0 };
  }

  if (creds.ok) {
    const user = createClient(creds.url, creds.anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: session, error: loginErr } = await user.auth.signInWithPassword({
      email: creds.email,
      password: creds.password,
    });
    if (loginErr) {
      relatorio.jwt = { ok: false, detalhe: loginErr.message };
    } else {
      const orgPick = await escolherOrgComPacientes(user);
      const orgId = orgPick.ok ? orgPick.orgId : null;
      const elos = [];
      for (const elo of elosGoldenParaLeitura()) {
        const q = user.from(elo.table).select("id", { count: "exact", head: true });
        const { error, count } = orgId ? await q.eq("org_id", orgId) : await q;
        elos.push({ id: elo.id, table: elo.table, optional: elo.optional, ...interpretarLeituraElo({ error, count, optional: elo.optional }) });
      }
      relatorio.jwt = {
        ok: true,
        role: orgPick.role || "",
        org: Boolean(orgId),
        clientesNaOrg: orgPick.clientes,
        elos,
      };
    }
  }

  const coreFaltando = relatorio.tabelas.filter((t) => t.core && t.status !== "EXISTE");
  return { ok: coreFaltando.length === 0, skip: "", relatorio, coreFaltando };
}

function md(rel) {
  const t = rel.tabelas || [];
  const existe = t.filter((r) => r.status === "EXISTE");
  const ausente = t.filter((r) => r.status === "AUSENTE");
  const outros = t.filter((r) => r.status !== "EXISTE" && r.status !== "AUSENTE");
  const colsOk = (rel.colunas || []).filter((c) => c.status === "OK");
  const colsBad = (rel.colunas || []).filter((c) => c.status !== "OK");
  const lines = [
    `# Confronto Git × live — ${rel.quando?.slice(0, 19) || ""}`,
    "",
    `Host: \`${rel.host}\`. Service role = existência. JWT master = SELECT da org. **Não grava.**`,
    "",
    `## Tabelas: ${existe.length} existem / ${ausente.length} ausentes / ${outros.length} outros (de ${t.length})`,
    "",
    "### Núcleo (precisa existir)",
    "",
    ...(t.filter((r) => r.core).map((r) => `- \`${r.table}\`: **${r.status}** n=${r.count ?? "—"}`)),
    "",
    "### Legado (pode existir sem o app escrever)",
    "",
    ...(t.filter((r) => r.legacy).map((r) => `- \`${r.table}\`: **${r.status}** n=${r.count ?? "—"}`)),
    "",
    "### Ausentes",
    "",
    ...(ausente.length ? ausente.map((r) => `- \`${r.table}\``) : ["_nenhuma_"]),
    "",
    "### Com dado (count > 0)",
    "",
    ...existe.filter((r) => Number(r.count) > 0).map((r) => `- \`${r.table}\`: ${r.count}`),
    "",
    "## Colunas que o código usa",
    "",
    "| Tabela | Git | Status | Detalhe |",
    "|--------|-----|--------|---------|",
    ...(rel.colunas || []).map((c) => `| \`${c.table}.${c.cols}\` | ${c.git} | ${c.status} | ${(c.detalhe || "").slice(0, 80).replace(/\|/g, "/")} |`),
    "",
    `Colunas OK: ${colsOk.length}/${(rel.colunas || []).length}. Falhas: ${colsBad.length}.`,
    "",
    "## RPC portal (token lixo, service role)",
    "",
    ...(rel.rpcs || []).map((r) => `- \`${r.fn}\`: ${r.ok ? "OK (vazio)" : "FALHA"} — \`${r.code}\` ${r.msg || r.detalhe}`),
    "",
    "## Storage buckets",
    "",
    ...(rel.buckets || []).map((b) => `- \`${b.name}\`: ${b.status}${b.public === true ? " (público)" : b.public === false ? " (privado)" : ""} ${b.detalhe || ""}`),
    "",
    "## Agenda → clients vs clientes",
    "",
    rel.agendaFk
      ? `- amostra agenda=${rel.agendaFk.agendaAmostra}, ids=${rel.agendaFk.ids}, em \`clients\`=${rel.agendaFk.emClients}, em \`clientes\`=${rel.agendaFk.emClientes ?? "tabela erro"} ${rel.agendaFk.clientesErro || ""}`
      : "_sem amostra_",
    "",
    "## JWT master (SELECT org)",
    "",
  ];
  if (!rel.jwt) lines.push("_sem QA_EMAIL_MASTER / ANON_");
  else if (!rel.jwt.ok) lines.push(`Login falhou: ${rel.jwt.detalhe}`);
  else {
    lines.push(`role=${rel.jwt.role} org=${rel.jwt.org} clientesNaOrg=${rel.jwt.clientesNaOrg ?? "—"}`);
    lines.push("");
    for (const e of rel.jwt.elos || []) {
      lines.push(`- ${e.id} (\`${e.table}\`): ${e.estado} n=${e.count ?? "—"} ${e.detalhe || ""}`);
    }
  }
  lines.push("");
  lines.push("## Como ler");
  lines.push("");
  lines.push("- AUSENTE no núcleo = código novo contra banco velho.");
  lines.push("- COLUNA_AUSENTE = cole o SQL Git/`-colar.sql` correspondente.");
  lines.push("- RPC 42883 = função live com assinatura diferente do Git.");
  lines.push("- Legado EXISTE = ok se o app não escrever (appointments/clientes).");
  return lines.join("\n");
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const out = await confrontarLive();
  if (out.skip) {
    console.error("SKIP:", out.skip);
    process.exit(0);
  }
  const text = md(out.relatorio);
  const dest = join(ROOT, "docs", "CONFRONTO-GIT-LIVE.md");
  writeFileSync(dest, text, "utf8");
  console.log(text);
  console.log("\nEscrito:", dest);
  if (!out.ok) {
    console.error("Núcleo faltando:", out.coreFaltando.map((t) => t.table).join(", "));
    process.exitCode = 2;
  }
}

const isDirect =
  Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  main().catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}
