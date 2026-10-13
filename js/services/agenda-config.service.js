/**
 * Configurações de Agenda — respiro, obrigatoriedades
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { retryUnknownColumns } from "../utils/supabase-unknown-col.js";

function missingAgendaConfig(error) {
  const msg = String(error?.message || "");
  const code = String(error?.code || "");
  return code === "42P01" || code === "PGRST205" || /agenda_config|does not exist|schema cache/i.test(msg);
}

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/**
 * Valores padrão (caso não haja config no banco)
 */
const DEFAULT_CONFIG = {
  respiro_sala_minutos: 10,
  respiro_profissional_minutos: 5,
  sala_obrigatoria: true,
  profissional_obrigatorio: true,
};

/**
 * Busca configuração da organização (ou retorna defaults)
 */
export async function getAgendaConfig() {
  const orgId = getOrgOrThrow();
  const { data, error } = await withOrg(
    supabase.from("agenda_config").select("*").single()
  );
  if (error && (error.code === "PGRST116" || missingAgendaConfig(error))) {
    return { ...DEFAULT_CONFIG, org_id: orgId };
  }
  if (error) throw error;
  return data ?? { ...DEFAULT_CONFIG, org_id: orgId };
}

/**
 * Salva (upsert) configuração da organização
 */
export async function saveAgendaConfig({
  respiroSalaMinutos,
  respiroProfissionalMinutos,
  salaObrigatoria,
  profissionalObrigatorio,
}) {
  const orgId = getOrgOrThrow();
  const payload = { org_id: orgId };
  if (respiroSalaMinutos !== undefined) payload.respiro_sala_minutos = Number(respiroSalaMinutos);
  if (respiroProfissionalMinutos !== undefined) payload.respiro_profissional_minutos = Number(respiroProfissionalMinutos);
  if (salaObrigatoria !== undefined) payload.sala_obrigatoria = salaObrigatoria;
  if (profissionalObrigatorio !== undefined) payload.profissional_obrigatorio = profissionalObrigatorio;

  const { data, error } = await retryUnknownColumns(
    payload,
    (row) => supabase.from("agenda_config").upsert(row, { onConflict: "org_id" }).select().single(),
    { immutable: ["org_id"] }
  );
  if (error) {
    if (missingAgendaConfig(error)) {
      throw new Error("Rode o SQL supabase-fase0-empresa-agenda-colar.sql para gravar o respiro da agenda.");
    }
    throw error;
  }
  return data;
}
