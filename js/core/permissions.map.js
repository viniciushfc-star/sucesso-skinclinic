const ROLE_ALIASES = {
  staff: "funcionario",
  receptionist: "recepcao",
  recepcao: "recepcao",
  "recepção": "recepcao",
  professional: "profissional",
  profissional: "profissional",
};

/** Alinha convite `staff` ao mapa `funcionario`; recepção/profissional têm mapa próprio. */
export function normalizeRole(role) {
  const key = String(role || "").trim().toLowerCase();
  if (ROLE_ALIASES[key]) return ROLE_ALIASES[key];
  return role;
}

/** Papéis graváveis em organization_users / organization_invites. */
export const ALLOWED_STORED_ROLES = [
  "master",
  "gestor",
  "staff",
  "viewer",
  "funcionario",
  "recepcao",
  "profissional",
];

/** Convite pela Equipe (não oferece master). */
export const ALLOWED_INVITE_ROLES = ["recepcao", "profissional", "staff", "viewer"];

export function inviteRoleLabel(role) {
  const r = normalizeRole(role);
  const labels = {
    master: "Administrador",
    gestor: "Gestor",
    funcionario: "Acesso limitado",
    staff: "Acesso limitado",
    viewer: "Visualização",
    recepcao: "Recepção",
    profissional: "Profissional",
  };
  return labels[r] || labels[role] || role || "Membro";
}

export const ROLE_PERMISSIONS = {
  master: ["*"],

  gestor: [
    "dashboard:view",
    "agenda:view",
    "agenda:manage",
    "clientes:view",
    "clientes:manage",
    "clientes:edit",
    "team:view",
    "team:invite",
    "team:permissions",
    "financeiro:view",
    "relatorios:view",
    "logs:view",
    "logs:acknowledge",
    "auditoria:view",
    "auditoria:acknowledge",
    "planos:view",
    "backup:view",
    "backup:restore",
    "whatsapp:send",
    "ia:copilot",
    "ia:assist",
    "estoque:view",
    "procedimentos:view",
  ],

  /** Recepção: agenda + cadastro + WhatsApp. Sem financeiro, equipe, backup, Copiloto. */
  recepcao: [
    "dashboard:view",
    "agenda:view",
    "agenda:manage",
    "clientes:view",
    "clientes:manage",
    "clientes:edit",
    "whatsapp:send",
  ],

  /** Profissional: clínica + IA auxiliar. Sem financeiro, convite, WhatsApp API, Copiloto. */
  profissional: [
    "dashboard:view",
    "agenda:view",
    "agenda:manage",
    "clientes:view",
    "clientes:edit",
    "planos:view",
    "ia:assist",
    "estoque:view",
    "procedimentos:view",
  ],

  funcionario: [
    "dashboard:view",
    "agenda:view",
    "clientes:view"
  ]
};
export const PERMISSIONS = [
  // Core
  { key: "dashboard:view", label: "Ver dashboard" },

  // Agenda
  { key: "agenda:view", label: "Ver agenda" },
  { key: "agenda:manage", label: "Gerenciar agenda" },

  // Clientes
  { key: "clientes:view", label: "Ver clientes" },
  { key: "clientes:manage", label: "Gerenciar clientes" },
  { key: "clientes:edit", label: "Editar clientes (com auditoria)" },
  { key: "clientes:export", label: "Exportar clientes" },

  // Financeiro
  { key: "financeiro:view", label: "Ver financeiro" },
  { key: "financeiro:manage", label: "Gerenciar financeiro" },
  { key: "financeiro:export", label: "Exportar financeiro" },

  // Equipe
  { key: "team:view", label: "Ver equipe" },
  { key: "team:invite", label: "Convidar equipe" },
  { key: "team:permissions", label: "Configurar permissões" },
  { key: "team:remove", label: "Remover usuário" },

  // Relatórios
  { key: "relatorios:view", label: "Ver relatórios" },
  { key: "relatorios:export", label: "Exportar relatórios" },

  // Planos
  { key: "planos:view", label: "Ver planos terapêuticos" },

  // Backup
  { key: "backup:view", label: "Ver e baixar backup" },
  { key: "backup:restore", label: "Restaurar backup" },

  { key: "whatsapp:send", label: "Enviar WhatsApp pela API" },
  { key: "ia:copilot", label: "Usar Copiloto de IA" },
  { key: "ia:assist", label: "Usar IA auxiliar (preço, pele, skincare, OCR, protocolo)" },
  { key: "estoque:view", label: "Ver estoque (IA/sugestões)" },
  { key: "procedimentos:view", label: "Ver catálogo de procedimentos" },

  // Auditoria (master e gestor)
  { key: "logs:view", label: "Ver logs de auditoria (legado)" },
  { key: "logs:acknowledge", label: "Dar ok em itens de auditoria (legado)" },
  { key: "auditoria:view", label: "Ver auditoria" },
  { key: "auditoria:acknowledge", label: "Dar ok em itens de auditoria" }
];
