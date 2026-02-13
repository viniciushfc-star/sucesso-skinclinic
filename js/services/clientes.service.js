import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";
import { getApiBase } from "../core/api-base.js";
import { getCache, setCache } from "../utils/cache.js";
import { getLimits } from "./limits.service.js";

/* =========================
   HELPERS
========================= */

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) {
    throw new Error("Organização ativa não definida");
  }
  return orgId;
}

function getCacheKey(orgId, suffix = "") {
  return `clientes:${orgId}${suffix ? ":" + suffix : ""}`;
}

/** Estados do cliente (máquina de estados) */
export const CLIENT_STATES = {
  pre_cadastro: "Pré-cadastro",
  em_acompanhamento: "Em acompanhamento",
  pausado: "Pausado",
  alta: "Alta",
  arquivado: "Arquivado",
};

/* =========================
   READ
========================= */

/**
 * Lista clientes da organização com filtros e busca
 * @param {Object} filters - { search, state, responsible_user_id, created_after, last_event_after }
 */
export async function getClientes(filters = {}) {
  const orgId = getOrgOrThrow();
  const hasFilters = Object.keys(filters).filter((k) => filters[k] != null && filters[k] !== "").length > 0;
  const cacheKey = hasFilters ? getCacheKey(orgId, JSON.stringify(filters)) : getCacheKey(orgId);
  const cached = getCache(cacheKey);
  if (cached && !hasFilters) return cached;

  let query = supabase
    .from("clients")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (filters.state) {
    query = query.eq("state", filters.state);
  }
  if (filters.responsible_user_id) {
    query = query.eq("responsible_user_id", filters.responsible_user_id);
  }
  if (filters.created_after) {
    query = query.gte("created_at", filters.created_after);
  }

  const { data, error } = await query;

  if (error) throw error;

  let list = data || [];

  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim().toLowerCase();
    const termDigits = term.replace(/\D/g, "");
    list = list.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(term)) ||
        (c.email && c.email.toLowerCase().includes(term)) ||
        (c.phone && String(c.phone).includes(term)) ||
        (c.cpf && (c.cpf.includes(term) || c.cpf.includes(termDigits)))
    );
  }

  if (!hasFilters) {
    setCache(getCacheKey(orgId), list);
  }
  return list;
}

/**
 * Lista clientes que fazem aniversário hoje ou nos próximos dias (esta semana).
 * @param {"hoje" | "semana"} periodo - "hoje" = só hoje; "semana" = hoje + próximos 6 dias
 * @returns {Promise<Array<{id, name, phone, birth_date, _quando: string}>>}
 */
export async function getAniversariantes(periodo = "semana") {
  const orgId = getOrgOrThrow();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, phone, birth_date")
    .eq("org_id", orgId)
    .not("birth_date", "is", null);

  if (error) throw error;
  const list = data || [];

  const today = new Date();
  const hojeM = today.getMonth() + 1;
  const hojeD = today.getDate();

  const diasNoPeriodo = periodo === "hoje" ? [0] : [0, 1, 2, 3, 4, 5, 6];
  const setMD = new Set();
  for (const offset of diasNoPeriodo) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    setMD.add(`${d.getMonth() + 1}-${d.getDate()}`);
  }

  const out = [];
  for (const c of list) {
    const b = c.birth_date ? new Date(c.birth_date) : null;
    if (!b) continue;
    const m = b.getMonth() + 1;
    const d = b.getDate();
    const key = `${m}-${d}`;
    if (!setMD.has(key)) continue;
    const quando = m === hojeM && d === hojeD ? "hoje" : `dia ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
    out.push({ ...c, _quando: quando });
  }
  out.sort((a, b) => {
    const [ma, da] = [a.birth_date ? new Date(a.birth_date) : null, a.birth_date ? new Date(a.birth_date).getDate() : 0];
    const [mb, db] = [b.birth_date ? new Date(b.birth_date) : null, b.birth_date ? new Date(b.birth_date).getDate() : 0];
    if (!ma || !mb) return 0;
    const keyA = (ma.getMonth() + 1) * 100 + ma.getDate();
    const keyB = (mb.getMonth() + 1) * 100 + mb.getDate();
    return keyA - keyB;
  });
  return out;
}

/**
 * Remove tudo que não é dígito (para CPF)
 */
function normalizeCpf(cpf) {
  if (!cpf || typeof cpf !== "string") return null;
  const digits = cpf.replace(/\D/g, "");
  return digits.length === 11 ? digits : null;
}

/**
 * Busca cliente por CPF na organização (evitar duplicado)
 */
export async function getClientByCpf(cpf) {
  const orgId = getOrgOrThrow();
  const normalized = normalizeCpf(cpf);
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("org_id", orgId)
    .eq("cpf", normalized)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Retorna outro cliente (diferente do excludeClientId) com o mesmo CPF na organização, se existir.
 * Útil para exibir aviso de duplicidade no perfil.
 */
export async function getOtherClientWithSameCpf(cpf, excludeClientId) {
  const orgId = getOrgOrThrow();
  const normalized = normalizeCpf(cpf);
  if (!normalized || !excludeClientId) return null;

  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("org_id", orgId)
    .eq("cpf", normalized)
    .neq("id", excludeClientId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Busca um cliente por ID
 */
export async function getClientById(clientId) {
  if (!clientId) throw new Error("Cliente inválido");
  const orgId = getOrgOrThrow();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("org_id", orgId)
    .single();

  if (error) throw error;
  return data;
}

/* =========================
   CREATE
========================= */

/**
 * Cria cliente: nome + (telefone ou email) obrigatórios.
 * CPF opcional; se informado, evita duplicado na mesma org.
 * avatar_url opcional (foto do cadastro).
 */
export async function createClient({
  name,
  email,
  phone,
  cpf,
  birth_date,
  sex,
  notes,
  responsible_user_id,
  state = "em_acompanhamento",
  avatar_url,
}) {
  if (!name || !name.trim()) throw new Error("Nome é obrigatório");
  if (!email && !phone) throw new Error("Informe telefone ou e-mail");

  const orgId = getOrgOrThrow();

  const normalizedCpf = normalizeCpf(cpf);
  if (normalizedCpf) {
    const existing = await getClientByCpf(normalizedCpf);
    if (existing) {
      throw new Error("Já existe um cliente com este CPF nesta organização.");
    }
  }

  // Quem está cadastrando é sempre o usuário da sessão (auditoria automática pelo id)
  const { data: userData } = await supabase.auth.getUser();
  const currentUserId = userData?.user?.id;
  const responsibleId = responsible_user_id ?? currentUserId;

  const limits = await getLimits();
  if (limits?.limite_clientes) {
    const { count, error } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId);

    if (error) throw error;
    if (count >= limits.limite_clientes) {
      throw new Error("Limite de clientes do plano atingido");
    }
  }

  const row = {
    org_id: orgId,
    name: name.trim(),
    email: email?.trim() || null,
    phone: phone?.trim() || null,
    status: state === "arquivado" ? "archived" : "active",
  };

  const hasExtendedSchema = true;
  if (hasExtendedSchema) {
    row.birth_date = birth_date || null;
    row.sex = sex || null;
    row.notes = notes?.trim() || null;
    row.responsible_user_id = responsibleId;
    row.state = state || "em_acompanhamento";
    row.cpf = normalizedCpf || null;
    row.avatar_url = avatar_url || null;
  }

  const { data, error } = await supabase
    .from("clients")
    .insert(row)
    .select()
    .single();

  if (error) throw error;

  setCache(getCacheKey(orgId), null);
  return data;
}

/**
 * Upload da foto do cliente (Storage client-photos).
 * Caminho: org_id/client_id/avatar.ext
 * Retorna a URL pública para salvar em avatar_url.
 */
export async function uploadClientPhoto(orgId, clientId, file) {
  if (!orgId || !clientId || !file) throw new Error("Dados inválidos para upload");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${orgId}/${clientId}/avatar.${ext}`;

  const { error } = await supabase.storage
    .from("client-photos")
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from("client-photos").getPublicUrl(path);
  return data?.publicUrl || null;
}

/* =========================
   UPDATE
========================= */

export async function updateClient(clientId, updates) {
  if (!clientId) throw new Error("Cliente inválido");
  const orgId = getOrgOrThrow();

  const { data, error } = await supabase
    .from("clients")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) throw error;
  setCache(getCacheKey(orgId), null);
  return data;
}

/**
 * Transição de estado (evento registrado separadamente pelo caller)
 */
export async function updateClientState(clientId, newState) {
  const allowed = [
    "pre_cadastro",
    "em_acompanhamento",
    "pausado",
    "alta",
    "arquivado",
  ];
  if (!allowed.includes(newState)) throw new Error("Estado inválido");
  return updateClient(clientId, {
    state: newState,
    status: newState === "arquivado" ? "archived" : "active",
  });
}

/* =========================
   ARCHIVE
========================= */

export async function archiveClient(clientId) {
  return updateClientState(clientId, "arquivado");
}

/* =========================
   PORTAL DO CLIENTE (link para completar cadastro)
========================= */

/**
 * Cria sessão (link) para o cliente acessar o portal e completar o cadastro.
 * Usa a API do servidor (/api/create-portal-session). Base da API vem de getApiBase() (em localhost = porta 3000).
 * @returns {{ token: string, url: string }}
 */
export async function createClientPortalSession(clientId) {
  const orgId = getOrgOrThrow();
  if (!clientId) throw new Error("Cliente inválido");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Faça login para gerar o link");

  const url = `${getApiBase()}/api/create-portal-session`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ org_id: orgId, client_id: clientId }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404) {
      const base = getApiBase();
      const healthRes = await fetch(`${base}/api/health`).catch(() => null);
      if (healthRes?.ok) {
        throw new Error("A rota do portal não carregou no servidor. No terminal onde rodou npm start, veja se apareceu \"Rota não carregada: /api/create-portal-session\" e confira o .env (SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY).");
      }
      throw new Error("Servidor da API não está rodando. No terminal, execute: npm start e abra o app em http://localhost:3000");
    }
    throw new Error(json.error || "Não foi possível gerar o link");
  }

  return { token: json.token, url: json.url };
}
