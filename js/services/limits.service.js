import { supabase } from "../core/supabase.js"

export async function getLimits(){

 const { data:{ user }} =
  await supabase.auth.getUser()

 const { data } =
  await supabase
   .from("assinaturas")
   .select("*")
   .eq("user_id",user.id)
   .single()

 return data
}
