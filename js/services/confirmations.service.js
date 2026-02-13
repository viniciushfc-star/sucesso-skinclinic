import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";

function getOrgOrThrow(){
  const orgId = getActiveOrg();
  if(!orgId) throw new Error("Org ativa não definida");
  return orgId;
}

export async function createConfirmation(appointmentId){
  const orgId = getOrgOrThrow();
  const token = crypto.randomUUID();

  const { data, error } = await supabase
    .from("appointment_confirmations")
    .insert({
      appointment_id: appointmentId,
      org_id: orgId,
      token
    })
    .select()
    .single();

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

 const start =
  new Date(date);
 start.setHours(0,0,0,0);

 const end =
  new Date(date);
 end.setHours(23,59,59,999);

 const { data, error } =
  await supabase
   .from("appointments")
   .select(`
     id,
     scheduled_at,
     duration_minutes,
     status,
     client_id
   `)
   .eq("org_id", orgId)
   .gte("scheduled_at", start.toISOString())
   .lte("scheduled_at", end.toISOString())
   .order("scheduled_at");

 if(error) throw error;
 return data;
}

