/**
 * Calendário de conteúdo: CRUD, aprovação, agendamento.
 * Fluxo: rascunho → em_aprovacao → aprovado | rejeitado → agendado → publicado (notificação no horário).
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/** Lista conteúdos da org (filtro opcional por status). */
export async function listConteudoCalendario(filtroStatus = null) {
  const orgId = getOrgOrThrow();
  let q = supabase
    .from("conteudo_calendario")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (filtroStatus) q = q.eq("status", filtroStatus);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** Um item por id. */
export async function getConteudoCalendario(id) {
  const orgId = getOrgOrThrow();
  const { data, error } = await supabase
    .from("conteudo_calendario")
    .select("*")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();
  if (error) throw error;
  return data;
}

/** Cria conteúdo (rascunho). */
export async function createConteudoCalendario(payload) {
  const orgId = getOrgOrThrow();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("conteudo_calendario")
    .insert({
      org_id: orgId,
      titulo: payload.titulo?.trim() || null,
      conteudo: (payload.conteudo || "").trim() || "",
      canal: payload.canal || "geral",
      status: "rascunho",
      criado_por: user?.id ?? null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Atualiza conteúdo (só em rascunho ou rejeitado). */
export async function updateConteudoCalendario(id, payload) {
  const orgId = getOrgOrThrow();
  const row = await getConteudoCalendario(id);
  if (row.status !== "rascunho" && row.status !== "rejeitado")
    throw new Error("Só é possível editar conteúdo em rascunho ou rejeitado.");
  const update = {};
  if (payload.titulo !== undefined) update.titulo = (payload.titulo || "").trim() || null;
  if (payload.conteudo !== undefined) update.conteudo = (payload.conteudo || "").trim() || "";
  if (payload.canal !== undefined) update.canal = payload.canal || "geral";
  const { data, error } = await supabase
    .from("conteudo_calendario")
    .update(update)
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Envia para aprovação (rascunho → em_aprovacao). */
export async function enviarParaAprovacao(id) {
  const orgId = getOrgOrThrow();
  const row = await getConteudoCalendario(id);
  if (row.status !== "rascunho" && row.status !== "rejeitado")
    throw new Error("Só conteúdo em rascunho ou rejeitado pode ser enviado para aprovação.");
  const { data, error } = await supabase
    .from("conteudo_calendario")
    .update({ status: "em_aprovacao" })
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Aprova (em_aprovacao → aprovado). */
export async function aprovarConteudo(id) {
  const orgId = getOrgOrThrow();
  const { data: { user } } = await supabase.auth.getUser();
  const row = await getConteudoCalendario(id);
  if (row.status !== "em_aprovacao")
    throw new Error("Só conteúdo em aprovação pode ser aprovado.");
  const { data, error } = await supabase
    .from("conteudo_calendario")
    .update({
      status: "aprovado",
      aprovado_por: user?.id ?? null,
      aprovado_em: new Date().toISOString(),
      rejeitado_por: null,
      rejeitado_em: null,
      motivo_rejeicao: null
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Rejeita (em_aprovacao → rejeitado). */
export async function rejeitarConteudo(id, motivoRejeicao = "") {
  const orgId = getOrgOrThrow();
  const { data: { user } } = await supabase.auth.getUser();
  const row = await getConteudoCalendario(id);
  if (row.status !== "em_aprovacao")
    throw new Error("Só conteúdo em aprovação pode ser rejeitado.");
  const { data, error } = await supabase
    .from("conteudo_calendario")
    .update({
      status: "rejeitado",
      rejeitado_por: user?.id ?? null,
      rejeitado_em: new Date().toISOString(),
      motivo_rejeicao: (motivoRejeicao || "").trim() || null
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Agenda publicação (aprovado → agendado). */
export async function agendarConteudo(id, agendadoPara) {
  const orgId = getOrgOrThrow();
  const row = await getConteudoCalendario(id);
  if (row.status !== "aprovado")
    throw new Error("Só conteúdo aprovado pode ser agendado.");
  const dt = agendadoPara ? new Date(agendadoPara) : null;
  if (dt && isNaN(dt.getTime())) throw new Error("Data/hora de agendamento inválida.");
  const { data, error } = await supabase
    .from("conteudo_calendario")
    .update({
      status: "agendado",
      agendado_para: dt ? dt.toISOString() : null
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Remove agendamento (agendado → aprovado). */
export async function desagendarConteudo(id) {
  const orgId = getOrgOrThrow();
  const row = await getConteudoCalendario(id);
  if (row.status !== "agendado")
    throw new Error("Só conteúdo agendado pode ser desagendado.");
  const { data, error } = await supabase
    .from("conteudo_calendario")
    .update({ status: "aprovado", agendado_para: null })
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Marca como publicado manualmente (aprovado ou agendado → publicado). */
export async function marcarPublicado(id) {
  const orgId = getOrgOrThrow();
  const row = await getConteudoCalendario(id);
  if (row.status !== "aprovado" && row.status !== "agendado")
    throw new Error("Só conteúdo aprovado ou agendado pode ser marcado como publicado.");
  const { data, error } = await supabase
    .from("conteudo_calendario")
    .update({
      status: "publicado",
      publicado_em: new Date().toISOString(),
      agendado_para: row.status === "agendado" ? row.agendado_para : null
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Lista itens agendados cujo horário já passou (para o job processar). */
export async function listAgendadosVencidos() {
  const orgId = getOrgOrThrow();
  const { data, error } = await supabase
    .from("conteudo_calendario")
    .select("*")
    .eq("org_id", orgId)
    .eq("status", "agendado")
    .lte("agendado_para", new Date().toISOString());
  if (error) throw error;
  return data ?? [];
}

/**
 * Processa agendados vencidos: marca como publicado e cria notificação para postar manualmente.
 * Chamado ao abrir o calendário ou por cron (API).
 */
export async function processarAgendadosVencidos() {
  const orgId = getOrgOrThrow();
  const vencidos = await listAgendadosVencidos();
  const { data: { user } } = await supabase.auth.getUser();
  for (const item of vencidos) {
    await supabase
      .from("conteudo_calendario")
      .update({
        status: "publicado",
        publicado_em: new Date().toISOString()
      })
      .eq("id", item.id)
      .eq("org_id", orgId);
    const preview = (item.conteudo || "").slice(0, 200) + ((item.conteudo || "").length > 200 ? "…" : "");
    await supabase.from("notificacoes").insert({
      org_id: orgId,
      user_id: user?.id ?? null,
      titulo: "Post agendado para agora",
      mensagem: (item.titulo ? `"${item.titulo}" — ` : "") + "Conteúdo pronto para publicar manualmente:\n\n" + preview
    });
  }
  return vencidos.length;
}
