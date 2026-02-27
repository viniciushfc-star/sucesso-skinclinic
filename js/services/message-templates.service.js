/**
 * Modelos de mensagem por organização.
 * O master define textos; o sistema substitui: {nome_cliente}, {data}, {hora}, {nome_clinica}, {link_confirmar}
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";

const TIPOS = [
  { id: "lembrete_agendamento", label: "Lembrete de agendamento (WhatsApp/SMS)", placeholder: "Usado ao clicar em Lembrete na agenda." },
  { id: "lembrete_email_assunto", label: "E-mail — Assunto do lembrete", placeholder: "Assunto ao abrir e-mail de lembrete." },
  { id: "lembrete_email_corpo", label: "E-mail — Corpo do lembrete", placeholder: "Corpo do e-mail (use quebras de linha)." },
  { id: "aniversario", label: "Mensagem de aniversário", placeholder: "Enviada aos aniversariantes (Agenda ou lista de clientes)." },
  { id: "marketing", label: "Mensagem de marketing", placeholder: "Ex.: promoções, dicas; use em campanhas ou envio manual." },
];

export function getTipos() {
  return TIPOS;
}

function getOrgId() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/**
 * Lista todos os modelos da org (por tipo).
 */
export async function listTemplates() {
  const orgId = getOrgId();
  const { data, error } = await supabase
    .from("message_templates")
    .select("id, tipo, body, subject, updated_at")
    .eq("org_id", orgId)
    .order("tipo");
  if (error) throw error;
  return data ?? [];
}

/**
 * Retorna um modelo por tipo (ou null).
 */
export async function getTemplateByTipo(tipo) {
  const orgId = getOrgId();
  const { data, error } = await supabase
    .from("message_templates")
    .select("id, tipo, body, subject")
    .eq("org_id", orgId)
    .eq("tipo", tipo)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Salva ou atualiza modelo (upsert por org_id + tipo).
 */
export async function upsertTemplate({ tipo, body, subject }) {
  const orgId = getOrgId();
  const payload = {
    org_id: orgId,
    tipo: String(tipo).trim(),
    body: body != null ? String(body).trim() : "",
    subject: subject != null ? String(subject).trim() || null : null,
  };
  const { data, error } = await supabase
    .from("message_templates")
    .upsert(payload, { onConflict: "org_id,tipo", ignoreDuplicates: false })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Substitui placeholders no texto.
 * @param {string} text
 * @param {{ nome_cliente?: string, data?: string, hora?: string, nome_clinica?: string, link_confirmar?: string }} vars
 */
export function replacePlaceholders(text, vars = {}) {
  if (!text || typeof text !== "string") return "";
  let out = text;
  const map = {
    nome_cliente: vars.nome_cliente ?? "Cliente",
    data: vars.data ?? "",
    hora: vars.hora ?? "",
    nome_clinica: vars.nome_clinica ?? "Clínica",
    link_confirmar: vars.link_confirmar ?? "",
  };
  for (const [key, value] of Object.entries(map)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, "gi"), value);
  }
  return out;
}

/**
 * Textos padrão quando não há modelo salvo.
 */
export const DEFAULT_TEXTS = {
  lembrete_agendamento: "Olá, {nome_cliente}! Lembrete: você tem agendamento dia {data} às {hora}. — {nome_clinica}",
  lembrete_com_confirmar: "Olá, {nome_cliente}! Lembrete: você tem agendamento dia {data} às {hora}. Confirme sua presença em um clique: {link_confirmar} — {nome_clinica}",
  lembrete_email_assunto: "Lembrete: agendamento {data} às {hora} — {nome_clinica}",
  lembrete_email_corpo: "Olá, {nome_cliente}!\n\nLembrete: você tem agendamento dia {data} às {hora}.\n\n— {nome_clinica}",
  aniversario: "Olá, {nome_cliente}! Feliz aniversário! 🎂 Desejamos muita saúde e sucesso. — {nome_clinica}",
  aniversario_brinde: "Olá, {nome_cliente}! Feliz aniversário! 🎂 Desejamos muita saúde e sucesso. Visite-nos e retire seu brinde de aniversário! — {nome_clinica}",
  marketing: "Olá, {nome_cliente}! Temos novidades para você. Entre em contato. — {nome_clinica}",
};

/**
 * Retorna o texto final para um tipo: usa modelo da org se existir, senão o padrão; aplica placeholders.
 */
export async function buildMessage(tipo, vars, options = {}) {
  const { useConfirmar = false, brindeAniversario = false } = options;
  let template = await getTemplateByTipo(tipo);
  let body = (tipo === "lembrete_email_assunto" ? (template?.subject ?? template?.body) : (template?.body || "")) || "";

  if (!body.trim()) {
    if (tipo === "lembrete_agendamento") body = useConfirmar ? DEFAULT_TEXTS.lembrete_com_confirmar : DEFAULT_TEXTS.lembrete_agendamento;
    else if (tipo === "lembrete_email_assunto") body = DEFAULT_TEXTS.lembrete_email_assunto;
    else if (tipo === "lembrete_email_corpo") body = DEFAULT_TEXTS.lembrete_email_corpo;
    else if (tipo === "aniversario") body = brindeAniversario ? DEFAULT_TEXTS.aniversario_brinde : DEFAULT_TEXTS.aniversario;
    else if (tipo === "marketing") body = DEFAULT_TEXTS.marketing;
  }

  return replacePlaceholders(body, vars);
}

/**
 * Para e-mail: retorna { subject, body } usando templates ou padrão.
 */
export async function buildEmailLembrete(vars, linkConfirmar = "") {
  const v = { ...vars, link_confirmar: linkConfirmar };
  const subject = await buildMessage("lembrete_email_assunto", v);
  let body = await buildMessage("lembrete_email_corpo", v);
  if (linkConfirmar && body) body += "\n\nConfirme sua presença em um clique: " + linkConfirmar;
  return { subject, body };
}
