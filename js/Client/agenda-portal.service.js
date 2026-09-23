/**
 * Agenda no portal: listar procedimentos, horários livres, marcar, remarcar, cancelar.
 */
import { supabase } from "../core/supabase.js";
import { buildFreeSlots } from "../utils/portal-slots.js";

export { buildFreeSlots };

function getToken() {
  return typeof sessionStorage !== "undefined" ? sessionStorage.getItem("client_portal_token") : null;
}

function tokenOrThrow() {
  const token = getToken();
  if (!token) throw new Error("Sessão inválida. Acesse pelo link enviado.");
  return token;
}

export async function listPortalProcedures() {
  const { data, error } = await supabase.rpc("list_portal_procedures", { p_token: tokenOrThrow() });
  if (error) throw error;
  return data ?? [];
}

export async function listPortalBusyHours(dateYmd) {
  const { data, error } = await supabase.rpc("list_portal_busy_hours", {
    p_token: tokenOrThrow(),
    p_data: dateYmd
  });
  if (error) throw error;
  return (data ?? []).map((r) => {
    if (r && typeof r === "object") {
      return {
        hora: String(r.hora || "").slice(0, 5),
        duration_minutes: Number(r.duration_minutes) > 0 ? Number(r.duration_minutes) : 60,
      };
    }
    return { hora: String(r).slice(0, 5), duration_minutes: 30 };
  });
}

export async function listPortalJornadaAgenda() {
  const { data, error } = await supabase.rpc("list_portal_jornada_agenda", { p_token: tokenOrThrow() });
  if (error) throw error;
  return data ?? [];
}

export async function listPortalAppointments() {
  const { data, error } = await supabase.rpc("list_portal_appointments", { p_token: tokenOrThrow() });
  if (error) throw error;
  return data ?? [];
}

export async function createPortalAppointment({ data, hora, procedureId }) {
  const { data: id, error } = await supabase.rpc("create_portal_appointment", {
    p_token: tokenOrThrow(),
    p_data: data,
    p_hora: hora,
    p_procedure_id: procedureId
  });
  if (error) throw error;
  return id;
}

export async function reschedulePortalAppointment({ agendaId, data, hora }) {
  const { error } = await supabase.rpc("reschedule_portal_appointment", {
    p_token: tokenOrThrow(),
    p_agenda_id: agendaId,
    p_data: data,
    p_hora: hora
  });
  if (error) throw error;
}

export async function cancelPortalAppointment(agendaId) {
  const { error } = await supabase.rpc("cancel_portal_appointment", {
    p_token: tokenOrThrow(),
    p_agenda_id: agendaId
  });
  if (error) throw error;
}
