import { supabase } from "../core/supabase.js"
import { withOrg, getActiveOrg } from "../core/org.js"

const BACKUP_TABLES = ["clients", "agenda", "financeiro"]

export async function gerarBackup(){

 try{

  const backup = {}

  for(const t of BACKUP_TABLES){

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

  for(const table of BACKUP_TABLES){
   if (!Object.prototype.hasOwnProperty.call(data, table)) continue

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
