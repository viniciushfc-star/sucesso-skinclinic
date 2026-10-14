/**
 * Grava avisos só com org_id. Dedupa não lida pelo título. Sem push, sem WhatsApp.
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { getTodayLocal } from "./metrics.service.js";
import { listWaitlist } from "./waitlist.service.js";
import {
  TITULO_AVISO,
  recusarAvisoSemOrg,
  deveCriarAviso,
  mensagemAviso,
} from "../utils/avisos-clinica.js";

async function jaExisteNaoLida(titulo) {
  const { data, error } = await withOrg(
    supabase.from("notificacoes").select("id").eq("lida", false).eq("titulo", titulo).limit(1)
  );
  if (error) return true;
  return !!(data && data.length);
}

async function inserirAviso(tipo, qtd) {
  const orgId = getActiveOrg();
  if (recusarAvisoSemOrg(orgId)) return false;
  const titulo = TITULO_AVISO[tipo];
  const mensagem = mensagemAviso(tipo, qtd);
  if (!titulo || !mensagem) return false;
  const existe = await jaExisteNaoLida(titulo);
  if (!deveCriarAviso({ qtd, jaExisteNaoLida: existe })) return false;
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return false;
  const { error } = await supabase.from("notificacoes").insert({
    org_id: orgId,
    user_id: user.id,
    titulo,
    mensagem,
  });
  return !error;
}

export async function avisarSemResponsavel(qtd) {
  return inserirAviso("sem_responsavel", qtd);
}

export async function sincronizarAvisosClinica() {
  const orgId = getActiveOrg();
  if (recusarAvisoSemOrg(orgId)) return { criados: 0 };
  let criados = 0;
  try {
    const today = getTodayLocal();
    const endDate = new Date(`${today}T12:00:00`);
    endDate.setDate(endDate.getDate() + 7);
    const end = endDate.toISOString().slice(0, 10);
    const { data: items } = await withOrg(
      supabase.from("agenda").select("id").gte("data", today).lte("data", end).is("user_id", null)
    );
    if (await avisarSemResponsavel((items || []).length)) criados += 1;
  } catch (e) {
    console.warn("[AVISOS] sem responsável", e?.message || e);
  }
  try {
    const espera = await listWaitlist("aberta").catch(() => []);
    if (await inserirAviso("espera", (espera || []).length)) criados += 1;
  } catch (e) {
    console.warn("[AVISOS] espera", e?.message || e);
  }
  return { criados };
}
