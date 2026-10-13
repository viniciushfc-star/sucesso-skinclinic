/**
 * Matriz de papéis da clínica vs telas. Contador é aba do Financeiro, não login.
 * Portal do cliente é SPA à parte (token), não papel da equipe.
 */
import { ROLE_PERMISSIONS, normalizeRole } from "../core/permissions.map.js";

/** Telas (e a aba contador) vs a permissão que o SPA exige. */
export const TELAS_POR_PERM = [
  { view: "dashboard", perm: "dashboard:view", label: "Hoje" },
  { view: "agenda", perm: "agenda:view", label: "Agenda" },
  { view: "clientes", perm: "clientes:view", label: "Pacientes" },
  { view: "crm", perm: "clientes:manage", label: "CRM" },
  { view: "financeiro", perm: "financeiro:view", label: "Financeiro" },
  { view: "contador", perm: "financeiro:view", label: "Aba contador" },
  { view: "procedimento", perm: "procedimentos:view", label: "Procedimentos" },
  { view: "estoque", perm: "estoque:view", label: "Estoque" },
  { view: "planos", perm: "planos:view", label: "Planos" },
  { view: "copiloto", perm: "ia:copilot", label: "Copiloto" },
  { view: "team", perm: "team:view", label: "Equipe" },
];

export function papelPode(role, perm) {
  const r = normalizeRole(role);
  const allowed = ROLE_PERMISSIONS[r] || [];
  if (allowed.includes("*")) return true;
  return allowed.includes(perm);
}

export function telasDoPapel(role) {
  return TELAS_POR_PERM.filter((t) => papelPode(role, t.perm)).map((t) => t.view);
}

export function expectativasPapel() {
  return {
    funcionario: {
      tem: ["dashboard", "agenda", "clientes"],
      nao: ["financeiro", "contador", "crm", "copiloto", "procedimento", "estoque"],
    },
    recepcao: {
      tem: ["dashboard", "agenda", "clientes", "crm"],
      nao: ["financeiro", "contador", "copiloto", "procedimento", "estoque", "planos"],
    },
    profissional: {
      tem: ["dashboard", "agenda", "clientes", "planos", "estoque", "procedimento"],
      nao: ["financeiro", "contador", "crm", "copiloto"],
    },
    gestor: {
      tem: ["financeiro", "contador", "crm", "copiloto"],
      nao: [],
    },
  };
}
