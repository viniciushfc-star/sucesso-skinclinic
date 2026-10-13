import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { retryUnknownColumns } from "../utils/supabase-unknown-col.js";

export const SQL_WAITLIST = "supabase-fase0-waitlist-colar.sql";

export function missingWaitlistTable(error) {
  const msg = String(error?.message || "");
  const code = String(error?.code || "");
  return code === "42P01" || code === "PGRST205" || /agenda_waitlist|does not exist|schema cache/i.test(msg);
}

function sqlAusenteError() {
  const e = new Error("SQL_AUSENTE");
  e.code = "SQL_AUSENTE";
  return e;
}

export async function listWaitlist(status = "aberta") {
  let q = withOrg(
    supabase
      .from("agenda_waitlist")
      .select("id, client_id, nome, phone, procedure_name, preferred_date, notes, status, created_at")
      .order("created_at", { ascending: true })
  );
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) {
    if (missingWaitlistTable(error)) throw sqlAusenteError();
    throw error;
  }
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
  const { data, error } = await retryUnknownColumns(
    payload,
    (row) => supabase.from("agenda_waitlist").insert(row).select().single(),
    { immutable: ["org_id", "nome"] }
  );
  if (error) {
    if (missingWaitlistTable(error)) {
      throw new Error("Cole no Supabase o SQL " + SQL_WAITLIST + " para ativar a lista de espera.");
    }
    throw error;
  }
  return data;
}

export async function updateWaitlistStatus(id, status) {
  const { error } = await withOrg(
    supabase.from("agenda_waitlist").update({ status }).eq("id", id)
  );
  if (error) {
    if (missingWaitlistTable(error)) {
      throw new Error("Cole no Supabase o SQL " + SQL_WAITLIST + " para ativar a lista de espera.");
    }
    throw error;
  }
}
