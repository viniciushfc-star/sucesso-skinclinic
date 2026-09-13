/** Tipos da pasta fiscal (documentação da clínica para o contador). */
export const TIPOS_DOC_FISCAL = [
  { id: "contrato_social", label: "Contrato social / CCMEI" },
  { id: "cartao_cnpj", label: "Cartão CNPJ" },
  { id: "alvara", label: "Alvará / vigilância sanitária" },
  { id: "inscricao_municipal", label: "Inscrição municipal" },
  { id: "procuracao", label: "Procuração do contador" },
  { id: "certificado_digital", label: "Certificado digital (A1/A3)" },
  { id: "das", label: "DAS / guia paga" },
  { id: "nota_fiscal", label: "Notas fiscais do período" },
  { id: "extrato", label: "Extrato bancário" },
  { id: "outros", label: "Outros" },
];

export const REGIMES = [
  { id: "mei", label: "MEI" },
  { id: "simples", label: "Simples Nacional" },
  { id: "presumido", label: "Lucro presumido" },
  { id: "real", label: "Lucro real" },
  { id: "nao_informado", label: "Ainda não informado" },
];

/**
 * Alíquota aproximada Anexo III (serviços) sobre o faturamento dos últimos 12 meses.
 * Não substitui o cálculo do PGDAS (há r-fator e deduções).
 */
export function aliquotaSimplesAnexoIII(faturamento12m) {
  const v = Number(faturamento12m) || 0;
  if (v <= 180000) return 6;
  if (v <= 360000) return 11.2;
  if (v <= 720000) return 13.5;
  if (v <= 1800000) return 16;
  if (v <= 3600000) return 21;
  return 33;
}
