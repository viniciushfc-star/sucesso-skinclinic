/**
 * Fase 1 — inventário live via PostgREST (service role).
 * Não imprime secrets. Não altera o banco.
 *
 * Uso: node scripts/schema-probe-live.js
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
  "google_calendar_connections",
  "assinaturas",
  "convites",
];

function classify(error) {
  if (!error) return "EXISTE";
  const code = String(error.code || "");
  const msg = String(error.message || "");
  if (code === "PGRST205" || /could not find the table|schema cache|does not exist/i.test(msg)) {
    return "AUSENTE";
  }
  if (code === "42501" || /permission denied|row-level security/i.test(msg)) {
    return "EXISTE_MAS_BLOQUEADO";
  }
  return `ERRO:${code || msg.slice(0, 80)}`;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error("FALHA: SUPABASE_URL ou SUPABASE_SERVICE_KEY ausentes no .env");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const rows = [];

  for (const table of TABLES) {
    const { error } = await supabase.from(table).select("*", { head: true, count: "exact" }).limit(0);
    const status = classify(error);
    rows.push({ table, status, count: status === "EXISTE" ? "head-ok" : "", detail: error?.message || "" });
    console.log(`${status.padEnd(22)} ${table}${error && status.startsWith("ERRO") ? " — " + error.message : ""}`);
  }

  const existe = rows.filter((r) => r.status === "EXISTE").map((r) => r.table);
  const ausente = rows.filter((r) => r.status === "AUSENTE").map((r) => r.table);
  const outros = rows.filter((r) => r.status !== "EXISTE" && r.status !== "AUSENTE");

  const md = `# Probe live do schema — ${new Date().toISOString().slice(0, 10)}

Gerado por \`scripts/schema-probe-live.js\` (PostgREST head count).  
**Não** é pg_dump. Colunas, RLS e RPCs **não** são listados aqui.

Projeto URL host: \`${new URL(url).host}\`

## Existe no live (${existe.length})

${existe.map((t) => `- \`${t}\``).join("\n") || "_nenhuma_"}

## Ausente no live (${ausente.length})

${ausente.map((t) => `- \`${t}\``).join("\n") || "_nenhuma_"}

## Outros

${outros.map((r) => `- \`${r.table}\`: ${r.status} ${r.detail}`).join("\n") || "_nenhum_"}

## Interpretação

- \`appointments\` / \`clientes\` / \`convites\` / \`logs\` / \`assinaturas\`: se AUSENTE, o código que ainda aponta para elas é legado morto ou quebrado.
- \`organization_user_permissions\`: se AUSENTE, fail-closed em produção passa a 500 até a tabela existir (ciclo P0).
`;

  const out = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "FASE-1-PROBE-LIVE.md");
  writeFileSync(out, md, "utf8");
  console.log("\nEscrito:", out);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
