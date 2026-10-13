/**
 * Sessão aplicada no prontuário (ficha do paciente).
 * Não dispara WhatsApp. Sem rascunho de IA.
 */

export const TIPO_SESSAO_PRONTUARIO = "procedimento_aplicado";

export function textoProdutosSessao(produtos = []) {
  return (produtos || [])
    .filter((p) => p && String(p.produto_nome || "").trim())
    .map((p) => {
      const nome = String(p.produto_nome).trim();
      const q = Number(p.quantidade);
      return Number.isFinite(q) && q > 0 && q !== 1 ? `${nome} (${q})` : nome;
    })
    .join("; ");
}

export function detalheAplicadoProntuario(a = {}) {
  const prods = textoProdutosSessao(a.produtos_usados);
  const obs = String(a.observacao || "").trim();
  const desc = String(a.descricao || "").trim();
  return [desc, prods ? `Produtos: ${prods}` : "", obs].filter(Boolean).join(" · ");
}

export function aplicadoECritico(a = {}) {
  return /intercorr/i.test(String(a.observacao || "") + String(a.descricao || ""));
}

export function tituloSessaoNaLinha(eventType) {
  const t = String(eventType || "");
  if (t === TIPO_SESSAO_PRONTUARIO) return "Procedimento aplicado";
  return "";
}

export function payloadSessaoProntuario({
  procedimento,
  produtos,
  intercorrencia,
  agendaId,
  procedureId,
} = {}) {
  const proc = String(procedimento || "").trim() || "Procedimento";
  const mats = textoProdutosSessao(produtos);
  const inter = String(intercorrencia || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  if (/ia_preliminar/i.test(proc + mats + inter)) return null;
  const parts = [proc];
  if (mats) parts.push("Produtos: " + mats);
  if (inter) parts.push("Intercorrência: " + inter);
  const description = parts.join(". ").slice(0, 1200);
  const metadata = { origem: "sessao" };
  if (agendaId) metadata.agenda_id = String(agendaId);
  if (procedureId) metadata.procedure_id = String(procedureId);
  if (inter) metadata.intercorrencia = inter;
  return {
    event_type: TIPO_SESSAO_PRONTUARIO,
    description,
    is_critical: !!inter,
    created_by_client: false,
    metadata,
  };
}
