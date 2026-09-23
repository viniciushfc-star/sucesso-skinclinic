import { supabase } from "../core/supabase.js"
import { withOrg, getActiveOrg } from "../core/org.js"
import {
  BACKUP_TABLES,
  sanitizeRawTableRows,
  filterNewById,
} from "../utils/backup-restore.js"

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

/**
 * Restaura tabelas cruas sem apagar. Pula id já presente e linha de outra org.
 */
export async function restaurarBackup(data){
 try{
  const org = getActiveOrg()
  if (!org) throw new Error("Organização ativa não definida")
  const summary = {}

  for(const table of BACKUP_TABLES){
   if (!Object.prototype.hasOwnProperty.call(data, table)) continue
   const { ready, skippedForeign } = sanitizeRawTableRows(data[table], org)
   const { data: existing, error: listErr } = await withOrg(
     supabase.from(table).select("id")
   )
   if (listErr) throw listErr
   const { insert, skippedExisting } = filterNewById(
     ready,
     (existing || []).map((r) => r.id)
   )
   if (insert.length) {
     const { error } = await supabase.from(table).insert(insert)
     if (error) throw error
   }
   summary[table] = {
     inseridos: insert.length,
     ignorados_duplicados: skippedExisting,
     ignorados_outra_org: skippedForeign,
   }
  }
  return summary
 }catch(err){
  console.error("[RESTORE]",err)
  throw err
 }
}
