import { supabase } from "../core/supabase.js"
import { withOrg } from "../core/org.js"
import { getClientes } from "./clientes.service.js"
import { listProcedures } from "./procedimentos.service.js"
import { getFinanceiro } from "./financeiro.service.js"

/**
 * Exporta todos os dados no formato de backup único (JSON) aceito em "Restaurar backup".
 * Permite ida e volta: exportar aqui e importar em outra org ou depois.
 */
export async function exportarBackupUnico() {
  const [clientes, procedimentos, financeiro, agendaRows] = await Promise.all([
    getClientes({}).then((list) => list || []),
    listProcedures(false).then((list) => list || []),
    getFinanceiro().then((list) => list || []),
    withOrg(supabase.from("agenda").select("id, data, hora, procedimento, duration_minutes, cliente_id")).then((r) => r.data || []),
  ])

  const clientesById = (clientes || []).reduce((acc, c) => { acc[c.id] = c; return acc }, {})

  const backup = {
    clientes: (clientes || []).map((c) => ({
      nome: c.name,
      email: c.email || "",
      telefone: c.phone || "",
      cpf: c.cpf || "",
      data_nascimento: c.birth_date || "",
      sexo: c.sex || "",
      observacoes: c.notes || "",
      estado: c.state || "em_acompanhamento",
    })),
    procedimentos: (procedimentos || []).map((p) => ({
      nome: p.name,
      descricao: p.description || "",
      duracao_minutos: p.duration_minutes ?? 60,
      valor_cobrado: p.valor_cobrado ?? "",
      codigo: p.codigo || "",
      custo_material_estimado: p.custo_material_estimado ?? "",
      margem_minima_desejada: p.margem_minima_desejada ?? "",
      tipo_procedimento: p.tipo_procedimento || "",
    })),
    financeiro: (financeiro || []).map((f) => ({
      data: f.data,
      valor: f.valor,
      tipo: f.tipo || "saida",
      descricao: f.descricao || "",
      categoria_saida: f.categoria_saida || "",
      conta_origem: f.conta_origem || "",
    })),
    agenda: (agendaRows || []).map((a) => {
      const cliente = a.cliente_id ? clientesById[a.cliente_id] : null
      return {
        data: a.data,
        hora: a.hora || "",
        cliente: cliente ? cliente.name : "",
        procedimento: a.procedimento || "",
        duracao_minutos: a.duration_minutes ?? 60,
      }
    }),
  }
  return backup
}

export async function exportarTabela(tabela){
 try{
  const { data, error } =
   await withOrg(
    supabase.from(tabela).select("*")
   )
  if(error) throw error
  return data
 }catch(err){
  console.error("[EXPORT]",err)
  throw err
 }
}
