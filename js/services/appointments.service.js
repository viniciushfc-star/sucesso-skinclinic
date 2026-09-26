import { supabase } from "../core/supabase.js";
import { getActiveOrg, getOrgMembers, withOrg } from "../core/org.js";
import { getAgendaConfig } from "./agenda-config.service.js";
import { getProcedure } from "./procedimentos.service.js";
import { getProfessionalIdsWhoCanDoProcedure } from "./professional-procedures.service.js";
import {
  DEFAULT_TRAVEL_MINUTES,
  conflitoExternoComDeslocamento,
  avaliarJornadaClinica,
} from "../utils/agenda-ocupacao.js";

function travelFromConfig(config) {
  const n = Number(config?.deslocamento_minutos);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_TRAVEL_MINUTES;
}

function getOrgOrThrow(){
 const orgId = getActiveOrg();
 if(!orgId) throw new Error("Org ativa não definida");
 return orgId;
}

/**
 * Cria horário na tabela canônica `agenda` (não usar `appointments`).
 */
export async function createAppointment({
 clientId,
 scheduledAt,
 durationMinutes = 60,
 procedimento = null,
}){
 const orgId = getOrgOrThrow();
 const dt = new Date(scheduledAt);
 if (Number.isNaN(dt.getTime())) throw new Error("Data/hora inválida");
 const data = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
 const hora = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;

 const { data: row, error } =
  await supabase
   .from("agenda")
   .insert({
    org_id: orgId,
    cliente_id: clientId,
    data,
    hora,
    duration_minutes: durationMinutes,
    procedimento,
   })
   .select()
   .single();

 if(error) throw error;
 return row;
}

/**
 * Confirma agendamento na `agenda`.
 */
export async function confirmAppointment(id){
 const orgId = getOrgOrThrow();

 const { error } =
  await supabase
   .from("agenda")
   .update({
    cancelled_at: null,
    confirmed_at: new Date().toISOString(),
   })
   .eq("id", id)
   .eq("org_id", orgId);

 if(error) throw error;
}

/**
 * Cancela / libera vaga na `agenda`.
 */
export async function releaseAppointment(id){
 const orgId = getOrgOrThrow();

 const { error } =
  await supabase
   .from("agenda")
   .update({
    cancelled_at: new Date().toISOString(),
   })
   .eq("id", id)
   .eq("org_id", orgId)
   .is("cancelled_at", null);

 if(error) throw error;
}

/**
 * Sala de espera: chegou | em_atendimento | limpar.
 * Não envia WhatsApp.
 */
export async function markAgendaArrival(id, phase) {
  const orgId = getOrgOrThrow();
  const now = new Date().toISOString();
  let patch;
  if (phase === "chegou") {
    patch = { arrived_at: now, started_at: null };
  } else if (phase === "em_atendimento") {
    patch = { started_at: now };
  } else if (phase === "limpar") {
    patch = { arrived_at: null, started_at: null };
  } else {
    throw new Error("Fase inválida");
  }

  const { data: current, error: readErr } = await supabase
    .from("agenda")
    .select("id, arrived_at")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (phase === "chegou" && current?.arrived_at) {
    patch = { started_at: null };
  }
  if (phase === "em_atendimento" && current && !current.arrived_at) {
    patch = { arrived_at: now, started_at: now };
  }

  const { error } = await supabase
    .from("agenda")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .is("cancelled_at", null);

  if (error) throw error;
}

/**
 * Lista agendamentos do dia (tabela agenda: data, hora, cliente_id, procedimento).
 * professionalId opcional: filtra por user_id (profissional que atende).
 */
export async function listAppointmentsByDate(date, professionalId = null) {
  const orgId = getOrgOrThrow();

  const q = supabase
    .from("agenda")
    .select("*, clients(name, phone, email)")
    .eq("org_id", orgId)
    .eq("data", date)
    .order("hora");
  const finalQ = professionalId ? q.eq("user_id", professionalId) : q;
  const { data, error } = await finalQ;

  if (error) throw error;
  return (data ?? []).filter((a) => !a.cancelled_at);
}

/**
 * Agendamentos num intervalo de datas (grade da semana).
 */
export async function listAppointmentsByRange(startDate, endDate, professionalId = null) {
  const orgId = getOrgOrThrow();
  const q = supabase
    .from("agenda")
    .select("*, clients(name, phone, email)")
    .eq("org_id", orgId)
    .gte("data", startDate)
    .lte("data", endDate)
    .order("data")
    .order("hora");
  const finalQ = professionalId ? q.eq("user_id", professionalId) : q;
  const { data, error } = await finalQ;
  if (error) throw error;
  return (data ?? []).filter((a) => !a.cancelled_at);
}

/**
 * Lista agendamentos do mês (para calendário: saber quantos por dia).
 * professionalId opcional: filtra por user_id.
 */
export async function listAppointmentsByMonth(year, month, professionalId = null) {
  const orgId = getOrgOrThrow();
  const y = Number(year);
  const m = Number(month);
  const firstDay = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDate = new Date(y, m, 0);
  const lastDayStr =
    lastDate.getFullYear() +
    "-" +
    String(lastDate.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(lastDate.getDate()).padStart(2, "0");

  let q = supabase
    .from("agenda")
    .select("data, cancelled_at")
    .eq("org_id", orgId)
    .gte("data", firstDay)
    .lte("data", lastDayStr);
  if (professionalId) q = q.eq("user_id", professionalId);

  let { data, error } = await q;

  if (error) {
    let q2 = supabase
      .from("agenda")
      .select("data")
      .eq("org_id", orgId)
      .gte("data", firstDay)
      .lte("data", lastDayStr);
    if (professionalId) q2 = q2.eq("user_id", professionalId);
    const fallback = await q2;
    if (fallback.error) throw fallback.error;
    return fallback.data ?? [];
  }

  return (data ?? []).filter((a) => !a.cancelled_at);
}

/**
 * Retorna um item da agenda por id (para painel lateral).
 * Inclui cliente (clientes ou clients) quando for procedimento.
 */
export async function getAgendaItemById(id) {
  const orgId = getOrgOrThrow();

  const { data, error } = await supabase
    .from("agenda")
    .select("*, clients(id, name, phone)")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Resumo do fluxo do cliente: procedimento anterior, atual e próximo.
 * Ajuda o profissional a mapear o processo e dar melhor experiência.
 * @param {string} clientId - cliente_id ou client_id
 * @param {string} currentAgendaId - id do agendamento atual (slot clicado)
 * @returns {{ anterior: { data, hora, procedimento } | null, atual: { data, hora, procedimento }, proximo: { data, hora, procedimento } | null }}
 */
export async function getClientAgendaResumo(clientId, currentAgendaId) {
  if (!clientId) return { anterior: null, atual: null, proximo: null };
  const orgId = getOrgOrThrow();
  const { data: rows, error } = await withOrg(
    supabase
      .from("agenda")
      .select("id, data, hora, procedimento")
      .eq("cliente_id", clientId)
      .order("data", { ascending: true })
      .order("hora", { ascending: true })
  );
  if (error || !rows || rows.length === 0) return { anterior: null, atual: null, proximo: null };
  const idx = rows.findIndex((r) => r.id === currentAgendaId);
  const format = (r) => (r ? { data: r.data, hora: r.hora || "", procedimento: r.procedimento || "—" } : null);
  const atual = idx >= 0 ? format(rows[idx]) : format(rows[0]);
  const anterior = idx > 0 ? format(rows[idx - 1]) : null;
  const proximo = idx >= 0 && idx < rows.length - 1 ? format(rows[idx + 1]) : null;
  return { anterior, atual, proximo };
}

/**
 * Constrói início/fim do slot em ISO (para overlap).
 */
function slotToRange(date, time, durationMinutes = 60) {
  const t = (time || "00:00").slice(0, 5);
  const start = new Date(date + "T" + t + ":00");
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return { start, end };
}

/**
 * Cria um bloco de calendário externo (indisponibilidade do profissional, ex.: compromisso na agenda pessoal).
 * Usado para conciliação com agenda de freelancer (Google, etc.).
 */
export async function createExternalBlock(userId, date, time, durationMinutes = 60) {
  const orgId = getOrgOrThrow();
  if (!userId) throw new Error("Profissional não informado para o bloqueio externo.");
  if (!date || !time) throw new Error("Data e hora são obrigatórias para o bloqueio externo.");

  const { start, end } = slotToRange(date, time, durationMinutes);

  const { error } = await supabase.from("external_calendar_blocks").insert({
    org_id: orgId,
    user_id: userId,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
  });

  if (error) throw error;
}

/**
 * Retorna user_ids dos profissionais disponíveis no horário (data + hora + duração).
 * Se procedureId for passado, só retorna profissionais que realizam esse procedimento (cruza professional_procedures).
 * Considera agenda (user_id, data, hora) e external_calendar_blocks.
 */
export async function getAvailableProfessionals(date, time, durationMinutes = 60, procedureId = null) {
  const orgId = getOrgOrThrow();
  const members = await getOrgMembers();
  let userIds = members.map((m) => m.user_id).filter(Boolean);
  if (userIds.length === 0) return [];

  if (procedureId) {
    const allowed = await getProfessionalIdsWhoCanDoProcedure(procedureId);
    if (allowed && allowed.length > 0) userIds = userIds.filter((id) => allowed.includes(id));
  }

  const { start: slotStart, end: slotEnd } = slotToRange(date, time, durationMinutes);
  let travelMin = DEFAULT_TRAVEL_MINUTES;
  try {
    travelMin = travelFromConfig(await getAgendaConfig());
  } catch (_) {}
  const travelMs = travelMin * 60000;
  const slotStartWithTravel = new Date(slotStart.getTime() - travelMs);
  const slotEndWithTravel = new Date(slotEnd.getTime() + travelMs);
  const slotStartWithTravelISO = slotStartWithTravel.toISOString();
  const slotEndWithTravelISO = slotEndWithTravel.toISOString();

  const busy = new Set();
  const agendaRows = await listAppointmentsByDate(date);
  for (const row of agendaRows) {
    const uid = row.user_id;
    if (!uid) continue;
    const rowHora = (row.hora || "00:00").slice(0, 5);
    const rowStart = new Date(row.data + "T" + rowHora + ":00");
    const rowDuration = row.duration_minutes || 60;
    const rowEnd = new Date(rowStart.getTime() + rowDuration * 60000);
    if (slotStart < rowEnd && rowStart < slotEnd) busy.add(uid);
  }

  const { data: blocks } = await supabase
    .from("external_calendar_blocks")
    .select("user_id, start_at, end_at")
    .eq("org_id", orgId)
    .lt("start_at", slotEndWithTravelISO)
    .gt("end_at", slotStartWithTravelISO);
  for (const b of blocks || []) {
    if (!b.user_id) continue;
    if (conflitoExternoComDeslocamento(slotStart, slotEnd, [b], travelMin)) busy.add(b.user_id);
  }

  for (const uid of userIds) {
    if (busy.has(uid)) continue;
    const clinicSlots = agendaRows
      .filter((row) => row.user_id === uid)
      .map((row) => {
        const rowHora = (row.hora || "00:00").slice(0, 5);
        const rowStart = new Date(row.data + "T" + rowHora + ":00");
        const rowDuration = row.duration_minutes || 60;
        return { start: rowStart, end: new Date(rowStart.getTime() + rowDuration * 60000) };
      });
    clinicSlots.push({ start: slotStart, end: slotEnd });
    const jornada = avaliarJornadaClinica(clinicSlots);
    if (!jornada.ok) busy.add(uid);
  }

  return userIds.filter((id) => !busy.has(id));
}

/**
 * Verifica se um profissional está disponível no horário.
 */
export async function checkProfessionalAvailable(professionalId, date, time, durationMinutes = 60) {
  const available = await getAvailableProfessionals(date, time, durationMinutes);
  return available.includes(professionalId);
}

/**
 * Verifica se uma sala está disponível no horário (considerando respiro).
 * Retorna { disponivel: boolean, conflito?: { inicio, fim, procedimento } }
 */
export async function checkSalaAvailable(salaId, date, time, durationMinutes = 60, excludeAgendaId = null) {
  if (!salaId) return { disponivel: true };
  const orgId = getOrgOrThrow();
  
  // Busca configuração de respiro
  let respiroMinutos = 10;
  try {
    const config = await getAgendaConfig();
    respiroMinutos = config.respiro_sala_minutos || 10;
  } catch (_) {}

  const { start: slotStart, end: slotEnd } = slotToRange(date, time, durationMinutes);
  
  // Busca agendamentos da mesma sala no dia
  let q = withOrg(
    supabase.from("agenda").select("id, hora, duration_minutes, procedimento").eq("data", date).eq("sala_id", salaId)
  );
  if (excludeAgendaId) q = q.neq("id", excludeAgendaId);
  const { data: rows } = await q;

  for (const row of rows || []) {
    const rowHora = (row.hora || "00:00").slice(0, 5);
    const rowStart = new Date(date + "T" + rowHora + ":00");
    const rowDuration = row.duration_minutes || 60;
    // Fim do agendamento existente + respiro
    const rowEndWithRespiro = new Date(rowStart.getTime() + (rowDuration + respiroMinutos) * 60000);
    // Início do slot solicitado deve ser >= fim + respiro do existente
    // Ou fim do slot solicitado deve ser <= início do existente - respiro
    const rowStartMinusRespiro = new Date(rowStart.getTime() - respiroMinutos * 60000);

    // Verifica sobreposição considerando respiro
    if (slotStart < rowEndWithRespiro && slotEnd > rowStartMinusRespiro) {
      return {
        disponivel: false,
        conflito: {
          inicio: rowHora,
          fim: formatTime(new Date(rowStart.getTime() + rowDuration * 60000)),
          procedimento: row.procedimento || "Agendamento",
          respiroNecessario: respiroMinutos,
        },
      };
    }
  }

  return { disponivel: true };
}

/**
 * Verifica disponibilidade do profissional considerando respiro.
 * Retorna { disponivel: boolean, conflito?: { inicio, fim, procedimento } }
 */
export async function checkProfessionalAvailableWithRespiro(professionalId, date, time, durationMinutes = 60, excludeAgendaId = null) {
  if (!professionalId) return { disponivel: true };
  const orgId = getOrgOrThrow();

  let respiroMinutos = 5;
  let travelMin = DEFAULT_TRAVEL_MINUTES;
  try {
    const config = await getAgendaConfig();
    respiroMinutos = config.respiro_profissional_minutos || 5;
    travelMin = travelFromConfig(config);
  } catch (_) {}

  const { start: slotStart, end: slotEnd } = slotToRange(date, time, durationMinutes);

  // Busca agendamentos do profissional no dia
  let q = withOrg(
    supabase.from("agenda").select("id, hora, duration_minutes, procedimento").eq("data", date).eq("user_id", professionalId)
  );
  if (excludeAgendaId) q = q.neq("id", excludeAgendaId);
  const { data: rows } = await q;

  const clinicSlots = [];
  for (const row of rows || []) {
    const rowHora = (row.hora || "00:00").slice(0, 5);
    const rowStart = new Date(date + "T" + rowHora + ":00");
    const rowDuration = row.duration_minutes || 60;
    const rowEnd = new Date(rowStart.getTime() + rowDuration * 60000);
    clinicSlots.push({ start: rowStart, end: rowEnd });
    const rowEndWithRespiro = new Date(rowStart.getTime() + (rowDuration + respiroMinutos) * 60000);
    const rowStartMinusRespiro = new Date(rowStart.getTime() - respiroMinutos * 60000);

    if (slotStart < rowEndWithRespiro && slotEnd > rowStartMinusRespiro) {
      return {
        disponivel: false,
        conflito: {
          inicio: rowHora,
          fim: formatTime(new Date(rowStart.getTime() + rowDuration * 60000)),
          procedimento: row.procedimento || "Agendamento",
          respiroNecessario: respiroMinutos,
        },
      };
    }
  }

  clinicSlots.push({ start: slotStart, end: slotEnd });
  const jornada = avaliarJornadaClinica(clinicSlots);
  if (!jornada.ok) {
    return {
      disponivel: false,
      conflito: {
        inicio: formatTime(slotStart),
        fim: formatTime(slotEnd),
        procedimento: "Jornada do profissional",
        motivo: jornada.motivo,
        respiroNecessario: 0,
      },
    };
  }

  const travelMs = travelMin * 60000;
  const { data: blocks } = await supabase
    .from("external_calendar_blocks")
    .select("start_at, end_at")
    .eq("org_id", orgId)
    .eq("user_id", professionalId)
    .lt("start_at", new Date(slotEnd.getTime() + travelMs).toISOString())
    .gt("end_at", new Date(slotStart.getTime() - travelMs).toISOString());

  const ext = conflitoExternoComDeslocamento(slotStart, slotEnd, blocks || [], travelMin);
  if (ext) {
    return { disponivel: false, conflito: ext };
  }

  return { disponivel: true };
}

/**
 * Lista salas disponíveis em um horário específico (considerando respiro).
 * Se procedureId for passado, só retorna salas que suportam o tipo do procedimento (cruza salas.procedimento_tipos).
 */
export async function getAvailableSalas(date, time, durationMinutes = 60, excludeAgendaId = null, procedureId = null) {
  const { listSalas } = await import("./salas.service.js");
  let salas = await listSalas();
  const disponiveis = [];
  for (const sala of salas) {
    const check = await checkSalaAvailable(sala.id, date, time, durationMinutes, excludeAgendaId);
    if (!check.disponivel) continue;
    if (procedureId) {
      const proc = await getProcedure(procedureId);
      const tipo = proc?.tipo_procedimento;
      if (tipo) {
        const tipos = sala.procedimento_tipos;
        if (Array.isArray(tipos) && tipos.length > 0 && !tipos.includes(tipo)) continue;
      }
    }
    disponiveis.push(sala);
  }
  return disponiveis;
}

/**
 * Blocos da agenda pessoal (só início/fim). Sem título.
 */
export async function listExternalBlocksForRange(startDate, endDate, professionalId) {
  if (!professionalId) return [];
  const orgId = getOrgOrThrow();
  const startIso = new Date(`${startDate}T00:00:00`).toISOString();
  const endIso = new Date(`${endDate}T23:59:59`).toISOString();
  const { data, error } = await supabase
    .from("external_calendar_blocks")
    .select("start_at, end_at")
    .eq("org_id", orgId)
    .eq("user_id", professionalId)
    .lt("start_at", endIso)
    .gt("end_at", startIso)
    .order("start_at");
  if (error) throw error;
  return data ?? [];
}

/**
 * Formata Date para string HH:MM
 */
function formatTime(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}