/**
 * Resumo curto do metadata de auditoria (o que mudou), sem ids internos.
 */
export function resumoMetadataAuditoria(metadata) {
  if (!metadata || typeof metadata !== "object") return "";
  const bits = [];
  const nome = String(metadata.nome || "").trim();
  if (nome) bits.push("Nome: " + nome);
  const descricao = String(metadata.descricao || "").trim();
  if (descricao) bits.push("Feito: " + descricao);
  const procedimento = String(metadata.procedimento || "").trim();
  if (procedimento) bits.push("Procedimento: " + procedimento);
  const produtos = Array.isArray(metadata.produtos)
    ? metadata.produtos.map((p) => String(p || "").trim()).filter(Boolean)
    : [];
  if (produtos.length) bits.push("Produtos: " + produtos.join(", "));
  const data = String(metadata.data || "").trim();
  const hora = String(metadata.hora || "").trim();
  if (data) bits.push("Quando: " + data + (hora ? " " + hora : ""));
  const nProc = metadata.procedure_ids_count;
  if (nProc != null && Number.isFinite(Number(nProc))) {
    bits.push(Number(nProc) + " procedimento(s) no plano");
  }
  return bits.join(" · ");
}
