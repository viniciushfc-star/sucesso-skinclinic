import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";

export async function getOrgSettings(){

 const orgId = getActiveOrg();
 if(!orgId)
  throw new Error("Org ativa não definida");

 const { data, error } =
  await supabase
   .from("org_settings")
   .select("*")
   .eq("org_id", orgId)
   .single();

 if(error){
  // se não existir, usamos defaults
  return {
   confirm_before_hours: 24,
   release_before_hours: 12
  };
 }

 return data;
}
