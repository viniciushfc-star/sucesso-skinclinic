import { supabase } from "../core/supabase.js";
import { withOrg } from "../core/org.js";

/**
 * Lista pacotes de um cliente (com procedimento e saldo de sessões).
 */
export async function listPacotesByClient(clientId) {
  if (!clientId) return [];
  const { data, error } = await withOrg(
    supabase
      .from("client_packages")
      .select("id, client_id, procedure_id, nome_pacote, total_sessoes, sessoes_utilizadas, valor_pago, valido_ate, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
  );
  if (error) return [];
  const rows = data ?? [];
  const procIds = [...new Set(rows.map((r) => r.procedure_id).filter(Boolean))];
  if (procIds.length === 0) return rows;
  const { data: procs } = await withOrg(
    supabase.from("procedures").select("id, name").in("id", procIds)
  );
  const procMap = (procs ?? []).reduce((acc, p) => { acc[p.id] = p.name; return acc; }, {});
  return rows.map((r) => ({
    ...r,
    procedure_name: r.procedure_id ? procMap[r.procedure_id] : null,
    sessoes_restantes: Math.max(0, (r.total_sessoes ?? 0) - (r.sessoes_utilizadas ?? 0)),
  }));
}

/**
 * Lista pacotes da organização (para relatório ou lista geral).
 * only_with_balance: em JS (PostgREST não compara duas colunas).
 */
export async function listPacotesByOrg(filters = {}) {
  let query = withOrg(
    supabase
      .from("client_packages")
      .select("id, client_id, procedure_id, nome_pacote, total_sessoes, sessoes_utilizadas, valor_pago, valido_ate, created_at")
      .order("created_at", { ascending: false })
  );
  if (filters.client_id) query = query.eq("client_id", filters.client_id);
  const { data, error } = await query;
  if (error) return [];
  let rows = data ?? [];
  if (filters.only_with_balance)
    rows = rows.filter((r) => (r.sessoes_utilizadas ?? 0) < (r.total_sessoes ?? 0));
  return rows;
}

/**
 * Cria um pacote (venda de N sessões ao cliente).
 * @param {Object} p - { client_id, procedure_id?, nome_pacote, total_sessoes, valor_pago?, valido_ate? }
 */
export async function createPacote(p) {
  const payload = {
    client_id: p.client_id,
    procedure_id: p.procedure_id || null,
    nome_pacote: String(p.nome_pacote || "").trim() || "Pacote de sessões",
    total_sessoes: Math.max(1, parseInt(p.total_sessoes, 10) || 1),
    sessoes_utilizadas: 0,
    valor_pago: p.valor_pago != null ? Number(p.valor_pago) : null,
    valido_ate: p.valido_ate || null,
  };
  const { data, error } = await withOrg(
    supabase.from("client_packages").insert(payload).select().single()
  );
  if (error) throw error;
  return data;
}

/**
 * Dá baixa em uma sessão do pacote (incrementa sessoes_utilizadas).
 * Opcional: agenda_id para vincular ao atendimento.
 */
export async function consumirSessao(packageId, agendaId = null) {
  if (!packageId) throw new Error("ID do pacote obrigatório");
  const { data: pack, error: fetchErr } = await withOrg(
    supabase.from("client_packages").select("id, total_sessoes, sessoes_utilizadas").eq("id", packageId).single()
  );
  if (fetchErr || !pack) throw new Error("Pacote não encontrado");
  const used = (pack.sessoes_utilizadas ?? 0) + 1;
  if (used > (pack.total_sessoes ?? 0)) throw new Error("Pacote já está esgotado");
  const { error: updateErr } = await withOrg(
    supabase.from("client_packages").update({ sessoes_utilizadas: used }).eq("id", packageId)
  );
  if (updateErr) throw updateErr;
  if (agendaId) {
    await withOrg(
      supabase.from("package_consumptions").insert({ package_id: packageId, agenda_id: agendaId })
    );
  } else {
    await withOrg(
      supabase.from("package_consumptions").insert({ package_id: packageId })
    );
  }
  return { sessoes_utilizadas: used, sessoes_restantes: (pack.total_sessoes ?? 0) - used };
}

/**
 * Pacotes do cliente que ainda têm sessões disponíveis (para escolher ao dar baixa).
 */
export async function listPacotesComSaldoByClient(clientId) {
  const all = await listPacotesByClient(clientId);
  return all.filter((p) => p.sessoes_restantes > 0 && (!p.valido_ate || new Date(p.valido_ate) >= new Date()));
}
