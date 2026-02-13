/**
 * Estudo de caso (Camada 3 do Protocolo) — casos anonimizados + perguntas para aprender.
 * Métricas: resposta_observada, perfil (tipo_pele + queixa), opcionalmente n_sessoes.
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";
import { getApiBase } from "../core/api-base.js";

function getOrgId() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

const RESPOSTAS = ["melhora", "sem_mudanca", "efeito_adverso"];

/** Lista casos de um protocolo (para a tela de estudo). */
export async function listCasosByProtocolo(protocoloId) {
  if (!protocoloId) return [];
  const orgId = getOrgId();
  const { data, error } = await supabase
    .from("estudo_casos")
    .select("id, tipo_pele, fototipo, queixa_principal, resposta_observada, n_sessoes, observacao, analise_pele_resumo, created_at")
    .eq("org_id", orgId)
    .eq("protocolo_id", protocoloId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Lista todos os casos da org (agrupados por protocolo). */
export async function listCasos(protocoloId = null) {
  const orgId = getOrgId();
  let q = supabase
    .from("estudo_casos")
    .select("id, protocolo_id, tipo_pele, fototipo, queixa_principal, resposta_observada, n_sessoes, created_at, analise_pele_resumo, protocolos(nome)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (protocoloId) q = q.eq("protocolo_id", protocoloId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** Agregação por protocolo: totais por resposta e frase de tendência. */
export async function getAgregacaoPorProtocolo(protocoloId) {
  if (!protocoloId) return { total: 0, por_resposta: {}, frase_tendencia: "" };
  const casos = await listCasosByProtocolo(protocoloId);
  const por_resposta = { melhora: 0, sem_mudanca: 0, efeito_adverso: 0 };
  for (const c of casos) {
    if (RESPOSTAS.includes(c.resposta_observada)) {
      por_resposta[c.resposta_observada] = (por_resposta[c.resposta_observada] || 0) + 1;
    }
  }
  const total = casos.length;
  const pctMelhora = total > 0 ? Math.round((por_resposta.melhora / total) * 100) : 0;
  const frase_tendencia =
    total > 0
      ? `Para perfis semelhantes (n=${total}), este protocolo teve melhora em ${pctMelhora}% dos casos. Tendência, não garantia.`
      : "";
  return { total, por_resposta, frase_tendencia, casos };
}

/** Cria um caso (anonimizado). */
export async function createEstudoCaso(payload) {
  const orgId = getOrgId();
  const { protocoloId, tipo_pele, fototipo, queixa_principal, resposta_observada, n_sessoes, observacao, analise_pele_resumo } = payload || {};
  if (!protocoloId || !resposta_observada) throw new Error("Protocolo e resposta observada são obrigatórios.");
  if (!RESPOSTAS.includes(resposta_observada)) throw new Error("Resposta observada deve ser: melhora, sem_mudanca ou efeito_adverso.");
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("estudo_casos")
    .insert({
      org_id: orgId,
      protocolo_id: protocoloId,
      tipo_pele: (tipo_pele || "").trim() || null,
      fototipo: (fototipo || "").trim() || null,
      queixa_principal: (queixa_principal || "").trim() || null,
      resposta_observada,
      n_sessoes: n_sessoes != null && n_sessoes !== "" ? parseInt(n_sessoes, 10) : null,
      observacao: (observacao || "").trim() || null,
      analise_pele_resumo: (analise_pele_resumo || "").trim() || null,
      created_by: user?.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

/** Busca um caso por id (com protocolo). */
export async function getEstudoCasoById(id) {
  if (!id) return null;
  const orgId = getOrgId();
  const { data, error } = await supabase
    .from("estudo_casos")
    .select("*, protocolos(nome)")
    .eq("org_id", orgId)
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

/** Lista perguntas de um caso. */
export async function listPerguntasByCaso(estudoCasoId) {
  if (!estudoCasoId) return [];
  const { data, error } = await supabase
    .from("estudo_caso_perguntas")
    .select("id, pergunta, resposta_ia, artigo_contexto, tipo, created_at")
    .eq("estudo_caso_id", estudoCasoId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Adiciona pergunta e chama a IA; salva pergunta + resposta. */
export async function addPerguntaEstudoCaso(estudoCasoId, pergunta, artigoContexto = null, tipo = "pergunta") {
  if (!estudoCasoId || !pergunta || !pergunta.trim()) throw new Error("Caso e pergunta são obrigatórios.");
  const caso = await getEstudoCasoById(estudoCasoId);
  if (!caso) throw new Error("Caso não encontrado.");
  const res = await fetch(`${getApiBase()}/api/estudo-caso-pergunta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caso_resumo: {
        tipo_pele: caso.tipo_pele,
        fototipo: caso.fototipo,
        queixa_principal: caso.queixa_principal,
        analise_pele_resumo: caso.analise_pele_resumo,
        resposta_observada: caso.resposta_observada,
        n_sessoes: caso.n_sessoes,
        observacao: caso.observacao,
      },
      pergunta: pergunta.trim(),
      artigo_contexto: artigoContexto && artigoContexto.trim() ? artigoContexto.trim() : null,
      tipo,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao obter resposta da IA.");
  }
  const { resposta_ia } = await res.json();
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("estudo_caso_perguntas")
    .insert({
      estudo_caso_id: estudoCasoId,
      pergunta: pergunta.trim(),
      resposta_ia: resposta_ia || null,
      artigo_contexto: artigoContexto && artigoContexto.trim() ? artigoContexto.trim() : null,
      tipo: tipo === "esclarecer" ? "esclarecer" : "pergunta",
      created_by: user?.user?.id ?? null,
    })
    .select("id, pergunta, resposta_ia, tipo, created_at")
    .single();
  if (error) throw error;
  return data;
}

/** Esclarecer dúvida após leitura de artigo (não precisa estar vinculado a um caso). */
export async function esclarecerDuvida(textoArtigoOuTema, duvida) {
  if (!duvida || !duvida.trim()) throw new Error("Descreva sua dúvida.");
  const res = await fetch(`${getApiBase()}/api/estudo-caso-esclarecer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      texto_artigo_ou_tema: (textoArtigoOuTema || "").trim() || null,
      duvida: duvida.trim(),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao esclarecer.");
  }
  const data = await res.json();
  return data.resposta || "";
}
