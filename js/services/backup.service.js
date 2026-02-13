import { supabase } from "../core/supabase.js"
import { withOrg, getActiveOrg } from "../core/org.js"

export async function gerarBackup(){

 try{

  const tables = [
   "clientes",
   "agendamentos",
   "financeiro"
  ]

  const backup = {}

  for(const t of tables){

   const { data, error } =
    await withOrg(
     supabase.from(t).select("*")
    )

   if(error) throw error

   backup[t] = data
  }

  return backup

 }catch(err){
  console.error("[BACKUP]",err)
  throw err
 }
}

export async function restaurarBackup(data){

 try{

  const org = getActiveOrg()

  for(const table in data){

   const rows =
    data[table]
     .map(r=>({
      ...r,
      org_id:org
     }))

   await supabase
    .from(table)
    .insert(rows)
  }

 }catch(err){
  console.error("[RESTORE]",err)
  throw err
 }
}
