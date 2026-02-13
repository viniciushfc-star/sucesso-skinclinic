/**
 * @deprecated Use audit.service.js (audit()) para registrar ações.
 * Este módulo grava na tabela "logs" (legado). Novas funcionalidades usam audit_logs via audit.service.js.
 */
import { supabase } from "../core/supabase.js"

export async function logAction(
 modulo,
 acao,
 detalhes={}
){

 const { data:{ user }} =
  await supabase.auth.getUser()

 return await supabase
  .from("logs")
  .insert({
    user_id:user.id,
    modulo,
    acao,
    detalhes
  })
}
