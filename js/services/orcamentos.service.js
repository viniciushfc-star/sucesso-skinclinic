import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";
import { totalOrcamento } from "../utils/orcamento.js";
import { deveGerarPacotesNoAceite, pacotesDoAceite } from "../utils/ciclo-ouro.js";
import { createPacote, listPacotesByOrcamento } from "./pacotes.service.js";

function missingTable(error) {
  const msg = String(error?.message || "");
  const code = String(error?.code || "");
  return code === "42P01" || code === "PGRST205" || /orcamentos|does not exist|schema cache/i.test(msg);
}

function orgIdOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

function normalizeItems(items) {
  return (items || [])
    .map((it) => ({
      procedure_id: it.procedure_id || null,
      name: String(it.name || "").trim(),
      qty: Number(it.qty) > 0 ? Number(it.qty) : 1,
      unit_price: Number(it.unit_price) >= 0 ? Number(it.unit_price) : 0,
      sessions: Number(it.sessions) > 0 ? Number(it.sessions) : Number(it.qty) > 0 ? Number(it.qty) : 1,
    }))
    .filter((it) => it.name);
}

export async function listOrcamentosByClient(clientId) {
  if (!clientId) return [];
  const orgId = orgIdOrThrow();
  const { data, error } = await supabase
    .from("orcamentos")
    .select("*")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) {
    if (missingTable(error)) return [];
    throw error;
  }
  return data || [];
}

export async function createOrcamento({ client_id, items, notes, valid_until, status = "rascunho" }) {
  const orgId = orgIdOrThrow();
  const clean = normalizeItems(items);
  if (!client_id) throw new Error("Cliente inválido");
  if (!clean.length) throw new Error("Inclua pelo menos um item");
  const { data, error } = await supabase
    .from("orcamentos")
    .insert({
      org_id: orgId,
      client_id,
      items: clean,
      notes: notes ? String(notes).trim() : null,
      valid_until: valid_until || null,
      status,
      sent_at: status === "enviado" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateOrcamentoStatus(id, status) {
  const orgId = orgIdOrThrow();
  const now = new Date().toISOString();
  const patch = { status, updated_at: now };
  if (status === "enviado") patch.sent_at = now;
  if (status === "aceito") patch.accepted_at = now;
  if (status === "recusado") patch.declined_at = now;
  const { data, error } = await supabase
    .from("orcamentos")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function aceitarOrcamento(id) {
  const orgId = orgIdOrThrow();
  const { data: row, error: getErr } = await supabase
    .from("orcamentos")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();
  if (getErr || !row) throw getErr || new Error("Orçamento não encontrado");
  if (!deveGerarPacotesNoAceite(row.status)) {
    const existentes = await listPacotesByOrcamento(id);
    return { orcamento: row, created: false, packages: existentes };
  }
  const orcamento = await updateOrcamentoStatus(id, "aceito");
  const existentes = await listPacotesByOrcamento(id);
  if (existentes.length) {
    return { orcamento, created: false, packages: existentes };
  }
  const packages = [];
  for (const p of pacotesDoAceite(row.items, row.client_id, id)) {
    packages.push(await createPacote(p));
  }
  return { orcamento, created: packages.length > 0, packages };
}

export { totalOrcamento, normalizeItems };
