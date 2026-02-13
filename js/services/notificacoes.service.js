import { supabase } from "../core/supabase.js"
import { withOrg } from "../core/org.js"

/* =========================
   NOTIFICAÇÕES SERVICE
========================= */

export async function getNotificacoes(){
 return await withOrg(
  supabase
   .from("notificacoes")
   .select("*")
   .order("created_at",{
    ascending:false
   })
 )
}

export async function countNaoLidas(){
 return await withOrg(
  supabase
   .from("notificacoes")
   .select("*",{count:"exact"})
   .eq("lida",false)
 )
}

export async function marcarLida(id){
 return await withOrg(
  supabase
   .from("notificacoes")
   .update({lida:true})
   .eq("id",id)
 )
}

export async function deletar(id){
 return await withOrg(
  supabase
   .from("notificacoes")
   .delete()
   .eq("id",id)
 )
}

export async function deletarTodas(){
 return await withOrg(
  supabase
   .from("notificacoes")
   .delete()
 )
}
