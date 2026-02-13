import { supabase } from "../core/supabase.js"

export async function saveToken(token, device){

 const { data:{ user }} =
  await supabase.auth.getUser()

 return await supabase
  .from("push_tokens")
  .insert({
    user_id:user.id,
    token,
    device
  })
}

export async function getTokens(){

 return await supabase
  .from("push_tokens")
  .select("*")
}
