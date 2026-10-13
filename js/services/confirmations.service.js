import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";
import { isUnknownColumnError, retryUnknownColumns } from "../utils/supabase-unknown-col.js";

function getOrgOrThrow(){
  const orgId = getActiveOrg();
  if(!orgId) throw new Error("Org ativa não definida");
  return orgId;
}

export async function createConfirmation(appointmentId){
  const orgId = getOrgOrThrow();
  const token = crypto.randomUUID();

  const { data, error } = await retryUnknownColumns(
    {
      appointment_id: appointmentId,
      org_id: orgId,
      token
    },
    (row) => supabase.from("appointment_confirmations").insert(row).select().single(),
    { immutable: ["appointment_id", "org_id"] }
  );

  if(error) throw error;
  return data;
}

export async function confirmByToken(token){
  // seta contexto do RLS
  await supabase.rpc("set_config", {
    key: "app.confirm_token",
    value: token,
    is_local: true
  });

  const { data, error } = await supabase
    .from("appointment_confirmations")
    .update({ confirmed_at: new Date().toISOString() })
    .is("confirmed_at", null)
    .select("appointment_id")
    .single();

  if(error) throw error;
  return data?.appointment_id;
}
export async function getAppointmentsByDate(date){

 const orgId = getOrgOrThrow();

 let { data, error } =
  await supabase
   .from("agenda")
   .select("id, data, hora, duration_minutes, cliente_id, cancelled_at")
   .eq("org_id", orgId)
   .eq("data", date)
   .order("hora");

 if (error && isUnknownColumnError(error) && /cancelled_at|duration_minutes/i.test(String(error.message || ""))) {
  const retry = await supabase
    .from("agenda")
    .select("id, data, hora, cliente_id")
    .eq("org_id", orgId)
    .eq("data", date)
    .order("hora");
  data = retry.data;
  error = retry.error;
 }

 if(error) throw error;
 return (data || []).filter((row) => !row.cancelled_at);
}

