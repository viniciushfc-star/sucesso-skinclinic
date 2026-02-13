/**
 * Inferência de categoria de saída a partir da descrição.
 * Ajuda o cliente: ao digitar "aluguel", "luz", etc., o sistema já classifica como custo fixo.
 */

/** Palavras-chave (minúsculas, sem acento) que indicam cada categoria */
const KEYWORDS = {
  custo_fixo: [
    "aluguel", "aluguel ", "luz", "energia", "eletricidade",
    "agua", "água", "agua ", "conta de agua", "conta de luz",
    "condominio", "condomínio", "condominio ",
    "internet", "banda larga", "wi-fi", "wifi",
    "telefone", "celular", "fixo", "operadora",
    "iptu", "iptu ", "imposto predial",
    "seguro", "seguros", "seguro ",
    "limpeza", "faxina", "diarista", "empresa de limpeza",
    "gas", "gás", "gás ", "botijao", "botijão",
    "material de escritorio", "material de escritório", "papelaria",
    "manutencao", "manutenção", "reparo", "reparos",
    "contador", "contabilidade", "honorarios contabeis",
    "software", "sistema", "assinatura", "mensalidade sistema",
    "marketing fixo", "propaganda fixa", "plano mensal",
  ],
  funcionario: [
    "salario", "salário", "salarios", "folha", "folha de pagamento",
    "pro-labore", "pro labore", "prolabore",
    "comissao", "comissão", "comissoes",
    "vale transporte", "vt", "vale refeicao", "vr",
    "ferias", "férias", "decimo", "décimo", "13 salario",
    "encargos", "inss", "fgts", "rescisao",
    "honorario profissional", "honorários", "pagamento profissional",
  ],
  insumos: [
    "material", "materiais", "insumo", "insumos",
    "produto", "produtos", "compra produto", "compra material",
    "fornecedor", "fornecedores", "nota fiscal compra",
    "cosmetico", "cosmético", "cosmeticos", "dermocosmetico",
    "filtro solar", "creme", "acido", "ácido", "serum",
    "consumiveis", "consumíveis", "descartaveis", "descartáveis",
    "luvas", "mascara", "máscara", "agulha", "seringa",
  ],
};

function normalizar(texto) {
  if (!texto || typeof texto !== "string") return "";
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

/**
 * Infere categoria_saida a partir da descrição da transação.
 * @param {string} descricao - Ex.: "Aluguel sala comercial", "Conta de luz", "Salário Maria"
 * @returns {'custo_fixo'|'funcionario'|'insumos'|null} - null = deixar como "outro" ou não preencher
 */
export function inferirCategoriaSaida(descricao) {
  const d = normalizar(descricao);
  if (!d) return null;

  for (const [categoria, palavras] of Object.entries(KEYWORDS)) {
    for (const p of palavras) {
      if (d.includes(p) || d === p) return categoria;
    }
  }
  return null;
}

/**
 * Lista de custos fixos comuns para o setup inicial (label + palavras usadas na inferência).
 */
export const CUSTOS_FIXOS_COMUNS = [
  { id: "aluguel", label: "Aluguel", descricao: "Aluguel" },
  { id: "condominio", label: "Condomínio", descricao: "Condomínio" },
  { id: "luz", label: "Luz / Energia", descricao: "Luz" },
  { id: "agua", label: "Água", descricao: "Água" },
  { id: "gas", label: "Gás", descricao: "Gás" },
  { id: "internet", label: "Internet", descricao: "Internet" },
  { id: "telefone", label: "Telefone / Celular", descricao: "Telefone" },
  { id: "iptu", label: "IPTU", descricao: "IPTU" },
  { id: "seguro", label: "Seguro", descricao: "Seguro" },
  { id: "limpeza", label: "Limpeza / Faxina", descricao: "Limpeza" },
  { id: "contabilidade", label: "Contador / Contabilidade", descricao: "Contabilidade" },
  { id: "software", label: "Software / Sistema", descricao: "Software" },
  { id: "outro", label: "Outro custo fixo", descricao: "Custo fixo" },
];
