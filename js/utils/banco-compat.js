/**
 * Compatibilidade Git × banco e pares duplicados.
 * Não grava. Não gera DROP.
 */

export const TABELAS_NUCLEO = [
  "organizations",
  "organization_users",
  "organization_user_permissions",
  "clients",
  "agenda",
  "procedures",
  "financeiro",
  "audit_logs",
];

/** Canônico = o que o Clinic OS usa. Legado = gêmeo antigo. */
export const PARES_DUPLICADOS = [
  {
    canon: "clients",
    legado: "clientes",
    motivo: "Paciente canônico é clients. clientes só fallback legado.",
  },
  {
    canon: "agenda",
    legado: "appointments",
    motivo: "Grade da clínica é agenda. appointments é nome antigo.",
  },
  {
    canon: "organization_invites",
    legado: "convites",
    motivo: "Convite de equipe vive em organization_invites.",
  },
  {
    canon: "audit_logs",
    legado: "logs",
    motivo: "Auditoria canônica é audit_logs.",
  },
];

const IGNORAR_FROM = new Set(["", "undefined", "null", "tabela"]);

export function extrairFrom(src) {
  const out = new Set();
  const re = /\.from\(\s*["']([a-z][a-z0-9_]*)["']/gi;
  let m;
  while ((m = re.exec(src))) {
    const t = m[1].toLowerCase();
    if (!IGNORAR_FROM.has(t)) out.add(t);
  }
  return [...out].sort();
}

export function extrairCreateTable(src) {
  const limpo = String(src || "").replace(/--.*$/gm, "");
  const out = new Set();
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z][a-z0-9_]*)/gi;
  let m;
  while ((m = re.exec(limpo))) {
    const t = m[1].toLowerCase();
    if (t.length >= 3) out.add(t);
  }
  return [...out].sort();
}

export function extrairRpc(src) {
  const out = new Set();
  const re = /\.rpc\(\s*["']([a-z][a-z0-9_]*)["']/gi;
  let m;
  while ((m = re.exec(src))) out.add(m[1].toLowerCase());
  return [...out].sort();
}

export function tabelasOpenApi(spec) {
  const paths = spec?.paths || {};
  const tables = [];
  for (const p of Object.keys(paths)) {
    if (!p.startsWith("/") || p.startsWith("/rpc/")) continue;
    const name = p.slice(1).split("/")[0];
    if (/^[a-z][a-z0-9_]*$/.test(name)) tables.push(name);
  }
  return [...new Set(tables)].sort();
}

export function rpcsOpenApi(spec) {
  const paths = spec?.paths || {};
  const rpcs = [];
  for (const p of Object.keys(paths)) {
    if (!p.startsWith("/rpc/")) continue;
    rpcs.push(p.slice("/rpc/".length).split("/")[0]);
  }
  return [...new Set(rpcs)].sort();
}

/**
 * @param {{ status?: string, count?: number|null }} canon
 * @param {{ status?: string, count?: number|null }} legado
 * @param {{ overlap?: number|null }} extra
 */
export function interpretarPar(canon, legado, extra = {}) {
  const cEx = canon?.status === "EXISTE";
  const lEx = legado?.status === "EXISTE";
  const cN = Number(canon?.count);
  const lN = Number(legado?.count);
  const overlap = extra.overlap == null ? null : Number(extra.overlap);
  if (!cEx && !lEx) {
    return { nivel: "INFO", acao: "nenhum dos dois existe no live", limpar: false };
  }
  if (cEx && !lEx) {
    return { nivel: "OK", acao: "só o canônico existe — sem gêmeo", limpar: false };
  }
  if (!cEx && lEx) {
    return {
      nivel: "FALTA",
      acao: "só o legado existe — o app canônico quebra ou cai em fallback",
      limpar: false,
    };
  }
  if ((Number.isFinite(lN) && lN === 0) || legado?.count === 0) {
    return {
      nivel: "OK",
      acao: "legado existe e está vazio — candidato a drop depois de backup (não automático)",
      limpar: true,
    };
  }
  if (overlap > 0) {
    return {
      nivel: "ATENCAO",
      acao: `${overlap} id(s) nas duas tabelas — risco de ficha duplicada`,
      limpar: false,
    };
  }
  return {
    nivel: "ATENCAO",
    acao: `os dois existem (canônico ${Number.isFinite(cN) ? cN : "?"}, legado ${Number.isFinite(lN) ? lN : "?"}) — conferir se o legado ainda recebe escrita`,
    limpar: false,
  };
}

export function veredicto({ nucleoFaltando, paresProblema, appFaltando }) {
  if ((nucleoFaltando || []).length) return "INCOMPATIVEL";
  if ((paresProblema || []).length || (appFaltando || []).length) return "PARCIAL";
  return "COMPATIVEL";
}

export function classificarErroTabela(error) {
  if (!error) return "EXISTE";
  const code = String(error.code || "");
  const msg = String(error.message || "");
  if (code === "PGRST205" || /could not find the table|schema cache|does not exist/i.test(msg)) return "AUSENTE";
  if (code === "42501" || /permission denied|row-level security/i.test(msg)) return "BLOQUEADO";
  return `ERRO:${code || msg.slice(0, 60)}`;
}
