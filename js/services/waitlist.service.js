import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";

export async function listWaitlist(status = "aberta") {
  let q = withOrg(
    supabase
      .from("agenda_waitlist")
      .select("id, client_id, nome, phone, procedure_name, preferred_date, notes, status, created_at")
      .order("created_at", { ascending: true })
  );
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function addWaitlistEntry(p) {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  const payload = {
    org_id: orgId,
    client_id: p.client_id || null,
    nome: String(p.nome || "").trim(),
    phone: String(p.phone || "").trim() || null,
    procedure_name: String(p.procedure_name || "").trim() || null,
    preferred_date: p.preferred_date || null,
    notes: String(p.notes || "").trim() || null,
    status: "aberta",
  };
  if (!payload.nome) throw new Error("Informe o nome de quem espera.");
  const { data, error } = await supabase.from("agenda_waitlist").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateWaitlistStatus(id, status) {
  const { error } = await withOrg(
    supabase.from("agenda_waitlist").update({ status }).eq("id", id)
  );
  if (error) throw error;
}
