/**
 * Análise de Pele por IA (MVP) — serviço para o dashboard (clínica).
 * Listar pendentes, obter uma, validar, incorporar à Anamnese (função Pele).
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { listFuncoes, createRegistro } from "./anamnesis.service.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/** Lista análises da org; por padrão só pending_validation. */
export async function listAnalisesPele(status = "pending_validation") {
  const orgId = getOrgOrThrow();
  let q = withOrg(
    supabase
      .from("analise_pele")
      .select("id, client_id, imagens, respostas, ia_preliminar, status, validado_em, created_at, clients(name)")
      .order("created_at", { ascending: false })
  );
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** Lista análises de pele de um cliente (para contexto em Skincare, etc.). Mais recentes primeiro. */
export async function listAnalisesPeleByClient(clientId) {
  if (!clientId) return [];
  const orgId = getOrgOrThrow();
  const { data, error } = await withOrg(
    supabase
      .from("analise_pele")
      .select("id, ia_preliminar, texto_validado, status, created_at")
      .eq("org_id", orgId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
  );
  if (error) throw error;
  return data ?? [];
}

/** Retorna uma análise por id (com cliente). */
export async function getAnalisePeleById(id) {
  const orgId = getOrgOrThrow();
  const { data, error } = await withOrg(
    supabase
      .from("analise_pele")
      .select("*, clients(id, name, phone, email)")
      .eq("id", id)
      .single()
  );
  if (error) throw error;
  return data;
}

/** Marca análise como validada (texto_validado opcional). */
export async function validarAnalisePele(id, textoValidado = null) {
  const orgId = getOrgOrThrow();
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await withOrg(
    supabase
      .from("analise_pele")
      .update({
        status: "validated",
        texto_validado: textoValidado && textoValidado.trim() ? textoValidado.trim() : null,
        validado_por: user?.user?.id || null,
        validado_em: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()
  );
  if (error) throw error;
  return data;
}

/** Incorpora análise validada à Anamnese (função Pele) e marca status = incorporated. */
export async function incorporarAnalisePeleNaAnamnese(id) {
  const analise = await getAnalisePeleById(id);
  if (!analise || analise.status !== "validated") {
    throw new Error("Análise não encontrada ou ainda não validada.");
  }
  const orgId = getOrgOrThrow();
  const funcoes = await listFuncoes();
  const pele = funcoes.find((f) => f.slug === "rosto_pele");
  if (!pele) throw new Error("Função Pele (rosto_pele) não encontrada na anamnese. Cadastre as funções padrão.");
  const { data: user } = await supabase.auth.getUser();
  const conteudo = [analise.ia_preliminar, analise.texto_validado].filter(Boolean).join("\n\n— Validação profissional:\n");
  const registro = await createRegistro({
    clientId: analise.client_id,
    funcaoId: pele.id,
    conteudo: conteudo || "Análise de pele (IA + validação) incorporada.",
    ficha: analise.respostas && typeof analise.respostas === "object" ? analise.respostas : {},
    fotos: Array.isArray(analise.imagens) ? analise.imagens : [],
    conduta_tratamento: null,
    agendaId: null,
    authorId: user?.user?.id || null,
  });
  const { data, error } = await withOrg(
    supabase
      .from("analise_pele")
      .update({ status: "incorporated", anamnesis_registro_id: registro.id })
      .eq("id", id)
      .select()
      .single()
  );
  if (error) throw error;
  return data;
}
