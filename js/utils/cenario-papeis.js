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
      tem: ["dashboard", "agenda", "clientes", "crm", "financeiro", "contador", "copiloto"],
      nao: [],
    },
    master: {
      tem: ["dashboard", "agenda", "clientes", "crm", "financeiro", "contador", "copiloto", "team"],
      nao: [],
    },
    viewer: {
      tem: [],
      nao: ["financeiro", "contador", "crm", "copiloto", "agenda"],
    },
  };
}

/** Contador não é login: é aba do Financeiro (master/gestor). Cliente não é papel da equipe: é o portal. */
export const PAPEIS_PILOTO = [
  { id: "cliente", login: false, onde: "portal.html", titulo: "Paciente (portal)" },
  { id: "master", login: true, env: "QA_EMAIL_MASTER", titulo: "Administrador / dona" },
  { id: "gestor", login: true, env: "QA_EMAIL_GESTOR", titulo: "Gestor" },
  { id: "recepcao", login: true, env: "QA_EMAIL_RECEPCAO", titulo: "Recepção" },
  { id: "profissional", login: true, env: "QA_EMAIL_PROFISSIONAL", titulo: "Profissional" },
  { id: "funcionario", login: true, env: "QA_EMAIL_FUNCIONARIO", titulo: "Acesso limitado" },
  { id: "contador", login: false, onde: "#financeiro aba Contador", titulo: "Contador (aba, sem usuário próprio)" },
];

export function roteiroPilotoClinica() {
  return [
    {
      papel: "cliente",
      testes: [
        "Abrir o link do portal (sem login da equipe).",
        "Ver próximo horário e sessões. Não aparece rascunho de IA da pele.",
        "Completar cadastro / senha se pedido. Senha errada não entra.",
      ],
    },
    {
      papel: "master",
      testes: [
        "Hoje, Agenda, Pacientes, Relacionamento, Financeiro (aba Contador), Equipe.",
        "Criar horário: profissional ≠ quem vendeu.",
        "Lista de espera: Encaixar não manda WhatsApp sozinho.",
        "Skincare: destaque só com fonte.",
        "Copiloto sugere; nada grava preço sozinho.",
      ],
    },
    {
      papel: "gestor",
      testes: [
        "Vê financeiro e contador. Pode CRM e Copiloto.",
        "Não precisa ser a dona para fechar o mês.",
      ],
    },
    {
      papel: "recepcao",
      testes: [
        "Agenda, pacientes, CRM, WhatsApp no clique.",
        "Não vê Financeiro, Copiloto, Procedimentos, Estoque.",
      ],
    },
    {
      papel: "profissional",
      testes: [
        "Agenda, ficha, planos, estoque, procedimentos, IA auxiliar.",
        "Não vê Financeiro, CRM em massa, Copiloto, WhatsApp API.",
      ],
    },
    {
      papel: "funcionario",
      testes: [
        "Só Hoje, Agenda (ver) e Pacientes (ver).",
        "Não cria portal, não manda WhatsApp, não abre financeiro.",
      ],
    },
    {
      papel: "contador",
      testes: [
        "Entrar como master ou gestor → Financeiro → Contador.",
        "Relatório sem ia_preliminar. Não é um login separado.",
      ],
    },
  ];
}
