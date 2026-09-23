/**
 * Ciclo ouro SkinClinic — o que o código já amarra.
 * Não é E2E autenticado; serve para não perder o elo na regressão.
 */

export const GOLDEN_CYCLE = [
  { id: "paciente", view: "clientes.views.js", service: "clientes.service.js", table: "clients" },
  { id: "avaliacao", view: "analise-pele.views.js", service: "analise-pele.service.js", table: "analise_pele" },
  { id: "anamnese", view: "anamnese.views.js", service: "anamnesis.service.js", table: "anamnesis_registros" },
  { id: "plano", view: "planos.views.js", service: "planos-terapeuticos.service.js", table: "planos_terapeuticos" },
  { id: "protocolo", view: "protocolo.views.js", service: "protocolo-db.service.js", table: "protocolos" },
  { id: "aplicado", view: "agenda.views.js", service: "protocolo-db.service.js", table: "protocolos_aplicados" },
  { id: "estoque", view: "estoque.views.js", service: "estoque-entradas.service.js", table: "estoque_entradas" },
  { id: "custo", view: "procedimento.views.js", service: "procedimento-pl.service.js", table: "procedures" },
  { id: "margem", view: "financeiro.views.js", service: "audit.service.js", table: "financeiro" },
  { id: "crm", view: "crm.views.js", service: "crm.service.js", table: "agenda" },
  { id: "inteligencia", view: "dashboard.views.js", service: "intelligence.service.js", table: null },
];

export const SETUP_STEP_IDS = [
  "empresa",
  "equipe",
  "procedimento",
  "custo",
  "cliente",
  "agenda",
  "anamnese",
  "plano",
  "aplicado",
  "financeiro",
];
