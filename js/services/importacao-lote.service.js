/**
 * Importação em lote — Projeto Sucesso
 * Permite carregar clientes, procedimentos, financeiro (e custo fixo), agenda
 * a partir de CSV para tirar o gargalo de cadastro item a item e facilitar migração.
 */

/** Máximo de linhas por importação (evita timeout e sobrecarga). Ajuste no código se precisar. */
export const MAX_IMPORT_ROWS = 2000;

import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { createClient, getClientes, getClientByCpf } from "./clientes.service.js";
import { createProcedure, listProcedures } from "./procedimentos.service.js";
import { parseValor, parseData } from "./importacao-bancaria.service.js";
import { inferirCategoriaSaida } from "../utils/categoria-financeiro.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/**
 * Parse genérico de CSV: primeira linha = cabeçalho (normalizado em minúsculo, sem acento para chave).
 * Separador: ; ou ,
 */
function parseCSV(texto) {
  const lines = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const rawHeaders = lines[0].split(sep).map((h) => h.replace(/^"|"$/g, "").trim());
  const headers = rawHeaders.map((h) =>
    h
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, "_")
  );

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep).map((p) => p.replace(/^"|"$/g, "").trim());
    const obj = {};
    headers.forEach((h, j) => {
      obj[h] = parts[j] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

/** Coluna flexível: aceita vários nomes (ex.: nome, name, cliente) */
function col(row, ...names) {
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find(
      (c) =>
        c === n ||
        c.replace(/_/g, "") === n.replace(/_/g, "") ||
        c.includes(n) ||
        n.includes(c)
    );
    if (k != null) return row[k];
  }
  return undefined;
}

// --- Clientes ---

/**
 * Importa clientes a partir de linhas CSV (objetos com chaves normalizadas).
 * Colunas esperadas: nome/name, email, telefone/phone, cpf, data_nascimento, sexo, observacoes/notes, estado/state.
 * Duplicados por CPF ou e-mail são ignorados (não inseridos, contam em ignorados_duplicados).
 */
export async function importarClientes(rows) {
  const orgId = getOrgOrThrow();
  const result = { inseridos: 0, erros: [], ignorados_duplicados: 0 };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = col(r, "nome", "name", "cliente") ?? "";
    if (!name.trim()) {
      result.erros.push({ linha: i + 2, msg: "Nome obrigatório" });
      continue;
    }
    const email = (col(r, "email", "e-mail") ?? "").trim() || null;
    const phone = (col(r, "telefone", "phone", "celular", "tel") ?? "").trim() || null;
    if (!email && !phone) {
      result.erros.push({ linha: i + 2, msg: "Informe e-mail ou telefone" });
      continue;
    }
    const cpfRaw = (col(r, "cpf") ?? "").trim() || null;

    if (cpfRaw) {
      try {
        const existingCpf = await getClientByCpf(cpfRaw);
        if (existingCpf) {
          result.ignorados_duplicados++;
          continue;
        }
      } catch (_) {}
    }
    if (email) {
      const { data: existingEmail } = await supabase
        .from("clients")
        .select("id")
        .eq("org_id", orgId)
        .eq("email", email)
        .maybeSingle();
      if (existingEmail) {
        result.ignorados_duplicados++;
        continue;
      }
    }

    try {
      await createClient({
        name: name.trim(),
        email,
        phone,
        cpf: cpfRaw || undefined,
        birth_date: parseData(col(r, "data_nascimento", "nascimento", "birth_date") ?? "") || undefined,
        sex: (col(r, "sexo", "sex") ?? "").trim() || undefined,
        notes: (col(r, "observacoes", "notes", "observacao") ?? "").trim() || undefined,
        state: (col(r, "estado", "state", "status") ?? "em_acompanhamento").trim() || "em_acompanhamento",
      });
      result.inseridos++;
    } catch (e) {
      if (/já existe|duplicad|CPF/i.test(e.message || "")) {
        result.ignorados_duplicados++;
      } else {
        result.erros.push({ linha: i + 2, msg: e.message || String(e) });
      }
    }
  }
  return result;
}

// --- Procedimentos ---

/**
 * Importa procedimentos a partir de linhas CSV.
 * opts.pularDuplicados: se true, nome já existente na org é pulado. Se false, tenta todos (duplicados vão para erros).
 */
export async function importarProcedimentos(rows, opts = {}) {
  const pularDuplicados = opts.pularDuplicados !== false;
  getOrgOrThrow();
  const result = { inseridos: 0, erros: [], ignorados_duplicados: 0 };
  const existingNames = pularDuplicados
    ? new Set((await listProcedures(false)).map((p) => (p.name || "").toLowerCase().trim()).filter(Boolean))
    : null;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = (col(r, "nome", "name", "procedimento") ?? "").trim();
    if (!name) {
      result.erros.push({ linha: i + 2, msg: "Nome do procedimento obrigatório" });
      continue;
    }
    const nameKey = name.toLowerCase();
    if (pularDuplicados && existingNames.has(nameKey)) {
      result.ignorados_duplicados++;
      continue;
    }
    try {
      await createProcedure({
        name,
        description: (col(r, "descricao", "description") ?? "").trim() || undefined,
        durationMinutes:
          Number(col(r, "duracao_minutos", "duration_minutes", "duracao")) || 60,
        valorCobrado: parseValor(col(r, "valor_cobrado", "valor", "preco")) ?? undefined,
        codigo: (col(r, "codigo", "cod") ?? "").trim() || undefined,
        custoMaterialEstimado:
          parseValor(col(r, "custo_material_estimado", "custo_material")) ?? undefined,
        margemMinimaDesejada:
          parseValor(col(r, "margem_minima_desejada", "margem")) ?? undefined,
        tipoProcedimento: (col(r, "tipo_procedimento", "tipo") ?? "").trim() || undefined,
      });
      result.inseridos++;
      if (existingNames) existingNames.add(nameKey);
    } catch (e) {
      result.erros.push({ linha: i + 2, msg: e.message || String(e) });
    }
  }
  return result;
}

// --- Financeiro (incl. custo fixo) ---

/**
 * Importa transações financeiras (e/ou custo fixo) a partir de CSV.
 * Colunas: data, valor, tipo (entrada/saida), descricao, categoria_saida (funcionario, insumos, custo_fixo, outro), conta_origem.
 * Se forCustoFixo = true, força tipo=saida e categoria_saida=custo_fixo.
 */
export async function importarFinanceiro(rows, forCustoFixo = false) {
  const orgId = getOrgOrThrow();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada");

  const result = { inseridos: 0, erros: [] };
  const toInsert = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const dataStr = parseData(col(r, "data", "date") ?? "");
    const valorRaw = col(r, "valor", "value");
    const valor = parseValor(valorRaw);
    if (!dataStr) {
      result.erros.push({ linha: i + 2, msg: "Data inválida" });
      continue;
    }
    if (valor == null || valor <= 0) {
      result.erros.push({ linha: i + 2, msg: "Valor inválido" });
      continue;
    }
    let tipo = (col(r, "tipo", "type") ?? "").toLowerCase();
    if (forCustoFixo) {
      tipo = "saida";
    } else if (tipo !== "entrada" && tipo !== "saida") {
      tipo = valor < 0 ? "saida" : "entrada";
    }
    const descricao =
      (col(r, "descricao", "historico", "historico", "desc") ?? "").trim().slice(0, 500) ||
      "Importado";
    let categoria_saida = null;
    if (tipo === "saida") {
      categoria_saida = forCustoFixo
        ? "custo_fixo"
        : (col(r, "categoria_saida", "categoria", "category") ?? "").toLowerCase().trim() || null;
      if (categoria_saida && !["funcionario", "insumos", "custo_fixo", "outro"].includes(categoria_saida))
        categoria_saida = "outro";
      if (!categoria_saida && descricao)
        categoria_saida = inferirCategoriaSaida(descricao) || null;
    }
    toInsert.push({
      org_id: orgId,
      user_id: user.id,
      data: dataStr,
      valor: Math.abs(valor),
      tipo: tipo === "entrada" ? "entrada" : "saida",
      descricao,
      importado: true,
      origem_importacao: forCustoFixo ? "csv_custo_fixo" : "csv",
      conta_origem: (col(r, "conta_origem", "conta") ?? "").trim() || null,
      categoria_saida,
      procedure_id: null,
    });
  }

  if (toInsert.length === 0) return result;

  const { data, error } = await supabase
    .from("financeiro")
    .insert(toInsert)
    .select("id");
  if (error) {
    throw error;
  }
  result.inseridos = data?.length ?? 0;
  return result;
}

// --- Agenda ---

/**
 * Resolve client_id por nome, e-mail ou telefone (busca na org).
 */
async function resolveClientId(nomeOuContato) {
  const s = typeof nomeOuContato === "string" ? nomeOuContato : (nomeOuContato ?? "");
  if (!s.trim()) return null;
  const clientes = await getClientes({ search: s.trim() });
  return clientes.length > 0 ? clientes[0].id : null;
}

/**
 * Resolve procedure_id por nome do procedimento (lista da org).
 */
async function resolveProcedureId(nomeProcedimento) {
  if (!nomeProcedimento || !String(nomeProcedimento).trim()) return null;
  const procedures = await listProcedures(false);
  const n = String(nomeProcedimento).trim().toLowerCase();
  const p = procedures.find(
    (pr) => (pr.name || "").toLowerCase() === n || (pr.name || "").toLowerCase().includes(n)
  );
  return p ? p.id : null;
}

/**
 * Importa agenda a partir de CSV.
 * Colunas: data, hora, cliente (nome/email/telefone), procedimento (nome ou texto), duracao_minutos, profissional (opcional), sala (opcional).
 * Se cliente não for encontrado, insere sem cliente_id (só procedimento em texto). procedure_id resolvido por nome quando existir.
 */
export async function importarAgenda(rows) {
  const orgId = getOrgOrThrow();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão expirada");

  const result = { inseridos: 0, erros: [] };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const dataStr = parseData(col(r, "data", "date") ?? "") || (col(r, "data") ?? "").trim();
    const horaRaw = (col(r, "hora", "horario", "time") ?? "").trim();
    const hora = /^\d{1,2}:\d{2}/.test(horaRaw)
      ? horaRaw.slice(0, 5)
      : horaRaw.length >= 4
        ? `${horaRaw.slice(0, 2)}:${horaRaw.slice(2, 4)}`
        : null;
    if (!dataStr || !hora) {
      result.erros.push({ linha: i + 2, msg: "Data e hora obrigatórios" });
      continue;
    }
    const clienteRef = col(r, "cliente", "client", "nome_cliente") ?? "";
    const procedimentoTexto = (col(r, "procedimento", "procedure", "servico") ?? "").trim();
    const durationMinutes =
      Number(col(r, "duracao_minutos", "duration_minutes", "duracao")) || 60;

    let cliente_id = null;
    if (clienteRef) cliente_id = await resolveClientId(clienteRef);
    let procedure_id = null;
    if (procedimentoTexto) procedure_id = await resolveProcedureId(procedimentoTexto);

    const payload = {
      org_id: orgId,
      data: dataStr,
      hora,
      procedimento: procedimentoTexto || null,
      duration_minutes: durationMinutes,
      item_type: "procedure",
      user_id: null,
      professional_id: null,
      sala_id: null,
      cliente_id,
      procedure_id,
    };

    try {
      await supabase.from("agenda").insert(payload);
      result.inseridos++;
    } catch (e) {
      result.erros.push({ linha: i + 2, msg: e.message || String(e) });
    }
  }
  return result;
}

/**
 * Despacha importação conforme tipo.
 * tipos: 'clientes' | 'procedimentos' | 'financeiro' | 'custo_fixo' | 'agenda'
 * file: File (CSV) ou texto CSV.
 * opts.pularDuplicados: para clientes/procedimentos, true = pular duplicados; false = importar todas (duplicados viram erro para revisar).
 */
export async function importarLote(tipo, fileOrText, opts = {}) {
  const text =
    typeof fileOrText === "string"
      ? fileOrText
      : await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsText(fileOrText, "UTF-8");
        });

  const rows = parseCSV(text);
  if (rows.length === 0) throw new Error("Nenhuma linha válida no CSV");
  if (rows.length > MAX_IMPORT_ROWS) throw new Error("Máximo " + MAX_IMPORT_ROWS + " linhas por vez. Divida o arquivo e importe em partes.");

  const importOpts = { pularDuplicados: opts.pularDuplicados !== false };
  switch (tipo) {
    case "clientes":
      return importarClientes(rows, importOpts);
    case "procedimentos":
      return importarProcedimentos(rows, importOpts);
    case "financeiro":
      return importarFinanceiro(rows, false);
    case "custo_fixo":
      return importarFinanceiro(rows, true);
    case "agenda":
      return importarAgenda(rows);
    default:
      throw new Error("Tipo de importação não suportado: " + tipo);
  }
}

/**
 * Retorna cabeçalhos de exemplo para download do template CSV por tipo.
 */
export function getTemplateHeaders(tipo) {
  switch (tipo) {
    case "clientes":
      return [
        "nome",
        "email",
        "telefone",
        "cpf",
        "data_nascimento",
        "sexo",
        "observacoes",
        "estado",
      ];
    case "procedimentos":
      return [
        "nome",
        "descricao",
        "duracao_minutos",
        "valor_cobrado",
        "codigo",
        "custo_material_estimado",
        "margem_minima_desejada",
        "tipo_procedimento",
      ];
    case "financeiro":
    case "custo_fixo":
      return ["data", "valor", "tipo", "descricao", "categoria_saida", "conta_origem"];
    case "agenda":
      return [
        "data",
        "hora",
        "cliente",
        "procedimento",
        "duracao_minutos",
        "profissional",
        "sala",
      ];
    default:
      return [];
  }
}

/**
 * Importa um backup único (arquivo JSON com todas as seções).
 * Formato esperado: { clientes: [...], procedimentos: [...], financeiro: [...], agenda: [...] }
 * Cada array é uma lista de objetos com os mesmos campos dos CSV (ex.: nome/name, email, telefone para clientes).
 * Se outro sistema exportar um JSON nesse formato, o nosso sistema entende e distribui por módulo.
 */
export async function importarBackupUnico(fileOrText) {
  const text =
    typeof fileOrText === "string"
      ? fileOrText
      : await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsText(fileOrText, "UTF-8");
        });

  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error("Arquivo inválido: esperado JSON com chaves clientes, procedimentos, financeiro, agenda");
  }

  if (!data || typeof data !== "object") {
    throw new Error("Arquivo JSON inválido");
  }

  const out = {};
  if (Array.isArray(data.clientes) && data.clientes.length > 0) {
    out.clientes = await importarClientes(data.clientes);
  }
  if (Array.isArray(data.procedimentos) && data.procedimentos.length > 0) {
    out.procedimentos = await importarProcedimentos(data.procedimentos);
  }
  if (Array.isArray(data.financeiro) && data.financeiro.length > 0) {
    out.financeiro = await importarFinanceiro(data.financeiro, false);
  }
  if (Array.isArray(data.custo_fixo) && data.custo_fixo.length > 0) {
    out.custo_fixo = await importarFinanceiro(data.custo_fixo, true);
  }
  if (Array.isArray(data.agenda) && data.agenda.length > 0) {
    out.agenda = await importarAgenda(data.agenda);
  }
  return out;
}

export { parseCSV };
