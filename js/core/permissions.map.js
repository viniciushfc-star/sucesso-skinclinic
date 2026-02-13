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
    "backup:restore"
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

  // Auditoria (master e gestor)
  { key: "logs:view", label: "Ver logs de auditoria (legado)" },
  { key: "logs:acknowledge", label: "Dar ok em itens de auditoria (legado)" },
  { key: "auditoria:view", label: "Ver auditoria" },
  { key: "auditoria:acknowledge", label: "Dar ok em itens de auditoria" }
];
