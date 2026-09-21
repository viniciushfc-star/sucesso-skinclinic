/**
 * LGPD operacional (P1-10): portabilidade e exclusão de titular.
 * Não é parecer jurídico nem declaração de conformidade.
 * Identidade some; o prontuário (o que foi feito na clínica) permanece.
 * Nunca inclui ia_preliminar no export.
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";
import { getSession } from "../core/auth.js";
import { audit } from "./audit.service.js";
import {
  isLgpdClientId,
  stripRestrictedExportFields,
  buildErasedClientPatch,
} from "../utils/lgpd-titular.js";

export { isLgpdClientId, stripRestrictedExportFields, buildErasedClientPatch };

/** Tabelas clínicas ligadas a client_id (falha silenciosa se a tabela não existir). */
export const LGPD_CLIENT_TABLES = [
  "client_events",
  "client_records",
  "client_sessions",
  "client_packages",
  "client_evolution_photos",
  "client_protocols",
  "analise_pele",
  "anamnesis_registros",
  "skincare_rotinas",
  "protocolos_aplicados",
  "planos_terapeuticos",
  "agenda_waitlist",
];

async function selectEq(table, orgId, col, value) {
  const { data, error } = await supabase.from(table).select("*").eq("org_id", orgId).eq(col, value);
  if (error) return [];
  return data || [];
}

async function selectAgenda(orgId, clientId) {
  const byCliente = await selectEq("agenda", orgId, "cliente_id", clientId);
  if (byCliente.length) return byCliente;
  return selectEq("agenda", orgId, "client_id", clientId);
}

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

export async function collectTitularExport(clientId) {
  if (!isLgpdClientId(clientId)) {
    throw new Error("Exportação do titular só está disponível no cadastro canônico (UUID).");
  }
  const orgId = getOrgOrThrow();
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  if (!client) throw new Error("Cliente não encontrado");

  const related = {};
  related.agenda = await selectAgenda(orgId, clientId);
  for (const table of LGPD_CLIENT_TABLES) {
    related[table] = stripRestrictedExportFields(table, await selectEq(table, orgId, "client_id", clientId));
  }

  let legacy = [];
  if (client.legacy_cliente_id != null) {
    legacy = await selectEq("clientes", orgId, "id", client.legacy_cliente_id);
  }

  return {
    exported_at: new Date().toISOString(),
    purpose: "portabilidade_titular",
    disclaimer:
      "Pacote gerado pela clínica no SkinClinic. Não inclui rascunho interno de IA (ia_preliminar). Não substitui orientação jurídica.",
    org_id: orgId,
    client: { ...client, avatar_url: client.avatar_url ? "[arquivo na clínica]" : null },
    legacy_clientes: legacy,
    related,
  };
}

export function downloadJsonFile(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportTitularJson(clientId) {
  const pack = await collectTitularExport(clientId);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadJsonFile(`titular-${String(clientId).slice(0, 8)}-${stamp}.json`, pack);
  await recordLgpdRequest({ clientId, kind: "export", counts: summarizeCounts(pack) });
  await audit({
    action: "lgpd.export",
    tableName: "clients",
    recordId: clientId,
    permissionUsed: "clientes:manage",
    metadata: { counts: summarizeCounts(pack) },
  });
  return pack;
}

function summarizeCounts(pack) {
  const related = pack?.related || {};
  const out = { agenda: (related.agenda || []).length };
  for (const t of LGPD_CLIENT_TABLES) out[t] = (related[t] || []).length;
  return out;
}

async function recordLgpdRequest({ clientId, kind, counts }) {
  const orgId = getOrgOrThrow();
  const session = await getSession();
  const { error } = await supabase.from("lgpd_requests").insert({
    org_id: orgId,
    client_id: clientId,
    kind,
    status: "completed",
    counts,
    created_by: session?.user?.id || null,
  });
  if (error) console.warn("[LGPD] lgpd_requests", error.message);
}

async function deleteByClient(table, orgId, clientId) {
  const { error } = await supabase.from(table).delete().eq("org_id", orgId).eq("client_id", clientId);
  if (error) console.warn("[LGPD] delete", table, error.message);
}

export async function eraseTitular(clientId) {
  if (!isLgpdClientId(clientId)) {
    throw new Error("Exclusão do titular só está disponível no cadastro canônico (UUID).");
  }
  const orgId = getOrgOrThrow();
  const { data: client, error } = await supabase
    .from("clients")
    .select("id, phone, legacy_cliente_id, lgpd_erased_at")
    .eq("id", clientId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error && !/lgpd_erased_at/i.test(error.message || "")) throw error;

  let row = client;
  if (!row) {
    const fallback = await supabase
      .from("clients")
      .select("id, phone, legacy_cliente_id")
      .eq("id", clientId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (fallback.error) throw fallback.error;
    row = fallback.data;
  }
  if (!row) throw new Error("Cliente não encontrado");
  if (row.lgpd_erased_at) throw new Error("Este titular já foi excluído.");

  // Só o acesso ao portal some. Prontuário (anamnese, fotos, protocolo, eventos, análise) fica.
  await deleteByClient("client_sessions", orgId, clientId);
  await supabase
    .from("analise_pele")
    .update({ ia_preliminar: null })
    .eq("org_id", orgId)
    .eq("client_id", clientId);

  if (row.phone) {
    const digits = String(row.phone).replace(/\D/g, "");
    if (digits.length >= 10) {
      await supabase.from("whatsapp_logs").delete().eq("org_id", orgId).eq("telefone", digits);
      await supabase.from("whatsapp_logs").delete().eq("org_id", orgId).eq("telefone", "55" + digits);
    }
  }

  const patch = {
    ...buildErasedClientPatch(clientId),
    lgpd_erased_at: new Date().toISOString(),
  };
  let upd = await supabase.from("clients").update(patch).eq("id", clientId).eq("org_id", orgId);
  if (upd.error && /lgpd_erased_at/i.test(upd.error.message || "")) {
    const { lgpd_erased_at, ...rest } = patch;
    upd = await supabase.from("clients").update(rest).eq("id", clientId).eq("org_id", orgId);
  }
  if (upd.error) throw upd.error;

  if (row.legacy_cliente_id != null) {
    await supabase
      .from("clientes")
      .update({ nome: "Titular excluído", email: null, telefone: null })
      .eq("id", row.legacy_cliente_id)
      .eq("org_id", orgId);
  }

  await recordLgpdRequest({
    clientId,
    kind: "erase",
    counts: {
      identity: "anonymized",
      portal_sessions: "revoked",
      retained: "prontuario",
    },
  });
  await audit({
    action: "lgpd.erase",
    tableName: "clients",
    recordId: clientId,
    permissionUsed: "clientes:manage",
    metadata: {
      retained: [
        "agenda",
        "financeiro",
        "protocolos_aplicados",
        "anamnesis_registros",
        "client_evolution_photos",
        "client_events",
        "client_records",
        "analise_pele",
        "skincare_rotinas",
        "client_packages",
      ],
      revoked: ["client_sessions"],
    },
  });
}
