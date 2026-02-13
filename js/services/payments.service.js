import { supabase } from "../core/supabase.js"

export async function getPlanos(){
 return await supabase
  .from("planos")
  .select("*")
}

export async function createAssinatura(plano){

 const { data:{ user }} =
  await supabase.auth.getUser()

 return await supabase
  .from("assinaturas")
  .insert({
   user_id:user.id,
   plano_id:plano,
   status:"ativo"
  })
}
