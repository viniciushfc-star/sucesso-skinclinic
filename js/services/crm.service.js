import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { getClientes } from "./clientes.service.js";

function daysBetween(isoDate, today = new Date()) {
  if (!isoDate) return Infinity;
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.floor((today.getTime() - d.getTime()) / 86400000);
}

/**
 * Última visita e quantidade de atendimentos (agenda não cancelada).
 */
export async function getClientVisitStats() {
  const orgId = getActiveOrg();
  if (!orgId) return { byClient: {}, rows: [] };

  const { data, error } = await withOrg(
    supabase
      .from("agenda")
      .select("cliente_id, data, cancelled_at")
      .order("data", { ascending: false })
      .limit(8000)
  );
  if (error) throw error;

  const byClient = {};
  for (const row of data ?? []) {
    if (row.cancelled_at || !row.cliente_id) continue;
    const cur = byClient[row.cliente_id] || { visits: 0, lastDate: null };
    cur.visits += 1;
    if (!cur.lastDate || row.data > cur.lastDate) cur.lastDate = row.data;
    byClient[row.cliente_id] = cur;
  }
  return { byClient };
}

/**
 * Clientes sem retorno há pelo menos `minDays` dias (ou nunca agendaram).
 */
export async function listInactiveClients(minDays = 60) {
  const clients = await getClientes();
  const { byClient } = await getClientVisitStats();
  const today = new Date();
  const out = [];
  for (const c of clients) {
    if (c.state === "arquivado") continue;
    const stats = byClient[c.id];
    const idle = stats?.lastDate ? daysBetween(stats.lastDate, today) : daysBetween((c.created_at || "").slice(0, 10), today);
    if (idle < minDays) continue;
    out.push({
      ...c,
      lastDate: stats?.lastDate || null,
      visits: stats?.visits || 0,
      idleDays: Number.isFinite(idle) ? idle : minDays,
    });
  }
  out.sort((a, b) => b.idleDays - a.idleDays);
  return out;
}

/**
 * Clientes que chegaram ou passaram da meta de visitas (fidelidade).
 */
export async function listLoyaltyClients(metaVisitas = 10) {
  const meta = Math.max(3, Number(metaVisitas) || 10);
  const clients = await getClientes();
  const { byClient } = await getClientVisitStats();
  const map = new Map(clients.map((c) => [c.id, c]));
  const out = [];
  for (const [id, stats] of Object.entries(byClient)) {
    const c = map.get(id);
    if (!c || c.state === "arquivado") continue;
    if (stats.visits < meta - 1) continue;
    out.push({
      ...c,
      visits: stats.visits,
      lastDate: stats.lastDate,
      falta: Math.max(0, meta - stats.visits),
      meta,
    });
  }
  out.sort((a, b) => b.visits - a.visits);
  return out;
}
