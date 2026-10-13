import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { getClientes } from "./clientes.service.js";
import { listPacotesByOrg } from "./pacotes.service.js";
import { getTodayLocal } from "./metrics.service.js";
import { isUnknownColumnError } from "../utils/supabase-unknown-col.js";
import { classificarSinalRadar } from "../utils/crm-fila.js";

function daysBetween(isoDate, today = new Date()) {
  if (!isoDate) return Infinity;
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return Infinity;
  return Math.floor((today.getTime() - d.getTime()) / 86400000);
}

function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n) && n > 0).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

/**
 * Última visita, quantidade e datas (agenda não cancelada).
 */
export async function getClientVisitStats() {
  const orgId = getActiveOrg();
  if (!orgId) return { byClient: {}, rows: [] };

  let { data, error } = await withOrg(
    supabase
      .from("agenda")
      .select("cliente_id, data, cancelled_at")
      .order("data", { ascending: false })
      .limit(8000)
  );
  if (error && isUnknownColumnError(error) && /cancelled_at/i.test(String(error.message || ""))) {
    const retry = await withOrg(
      supabase
        .from("agenda")
        .select("cliente_id, data")
        .order("data", { ascending: false })
        .limit(8000)
    );
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;

  const byClient = {};
  for (const row of data ?? []) {
    if (row.cancelled_at || !row.cliente_id || !row.data) continue;
    const cur = byClient[row.cliente_id] || { visits: 0, lastDate: null, dates: [] };
    cur.visits += 1;
    if (!cur.lastDate || row.data > cur.lastDate) cur.lastDate = row.data;
    if (cur.dates.length < 40) cur.dates.push(row.data);
    byClient[row.cliente_id] = cur;
  }
  for (const cur of Object.values(byClient)) {
    const uniq = [...new Set(cur.dates)].sort();
    const gaps = [];
    for (let i = 1; i < uniq.length; i++) {
      gaps.push(daysBetween(uniq[i - 1], new Date(`${uniq[i]}T12:00:00`)));
    }
    cur.medianGap = median(gaps);
  }
  return { byClient };
}

async function clientIdsComAgendaFutura() {
  const hoje = getTodayLocal();
  let { data, error } = await withOrg(
    supabase.from("agenda").select("cliente_id, cancelled_at, data").gte("data", hoje).limit(4000)
  );
  if (error && isUnknownColumnError(error) && /cancelled_at/i.test(String(error.message || ""))) {
    const retry = await withOrg(
      supabase.from("agenda").select("cliente_id, data").gte("data", hoje).limit(4000)
    );
    data = retry.data;
    error = retry.error;
  }
  const set = new Set();
  if (error) return set;
  for (const row of data ?? []) {
    if (row.cancelled_at || !row.cliente_id) continue;
    set.add(row.cliente_id);
  }
  return set;
}

/**
 * Radar de retorno: um sinal principal por cliente. Sem disparo automático.
 * @param {{ minDaysInativa?: number }} opts
 */
export async function getRadarRetorno(opts = {}) {
  const minDays = Math.max(21, Number(opts.minDaysInativa) || 60);
  const clients = await getClientes();
  const { byClient } = await getClientVisitStats();
  const future = await clientIdsComAgendaFutura();
  let pacotes = [];
  try {
    pacotes = await listPacotesByOrg();
  } catch (_) {
    pacotes = [];
  }
  const packByClient = new Map();
  for (const p of pacotes) {
    const total = Number(p.total_sessoes) || 0;
    const used = Number(p.sessoes_utilizadas) || 0;
    const rest = Math.max(0, total - used);
    const prev = packByClient.get(p.client_id) || { rest: 0, ended: false, nome: p.nome_pacote };
    prev.rest += rest;
    if (total > 0 && used >= total) {
      prev.ended = true;
      prev.nome = p.nome_pacote || prev.nome;
    } else if (rest > 0) {
      prev.nome = p.nome_pacote || prev.nome;
    }
    packByClient.set(p.client_id, prev);
  }

  const today = new Date();
  const out = [];
  for (const c of clients) {
    if (c.state === "arquivado") continue;
    const stats = byClient[c.id] || { visits: 0, lastDate: null, medianGap: null };
    const idle = stats.lastDate
      ? daysBetween(stats.lastDate, today)
      : daysBetween((c.created_at || "").slice(0, 10), today);
    const hasFuture = future.has(c.id);
    const pack = packByClient.get(c.id);
    const visits = stats.visits || 0;

    const classificado = classificarSinalRadar({
      visits,
      idleDays: idle,
      hasFuture,
      packRest: pack?.rest || 0,
      packEnded: !!(pack?.ended && !(pack?.rest > 0)),
      packNome: pack?.nome || "",
      medianGap: stats.medianGap,
      minDaysInativa: minDays,
    });
    let { sinal, motivo, acao } = classificado;
    if (sinal === "nova_sem_2" && stats.lastDate) {
      motivo = `Veio 1 vez (em ${stats.lastDate}) e não tem 2º atendimento.`;
    }

    if (!sinal) continue;
    out.push({
      ...c,
      lastDate: stats.lastDate || null,
      visits,
      idleDays: Number.isFinite(idle) ? idle : minDays,
      medianGap: stats.medianGap,
      hasFuture,
      sinal,
      motivo,
      acao,
    });
  }

  const ordem = { pacote: 0, plano_fim: 1, nova_sem_2: 2, atrasada: 3, sem_proxima: 4, inativa: 5 };
  out.sort((a, b) => (ordem[a.sinal] ?? 9) - (ordem[b.sinal] ?? 9) || b.idleDays - a.idleDays);
  return out;
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
