import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";
import { signedStorageUrl } from "../core/storage-url.js";
import { custoUnitarioComFrete } from "../utils/estoque-revenda.js";
import { isUnknownColumnError, stripUnknownColumn } from "../utils/supabase-unknown-col.js";
import { userFacingError } from "../core/errors.js";

function missingTable(error) {
  const msg = String(error?.message || "");
  const code = String(error?.code || "");
  return code === "42P01" || code === "PGRST205" || /estoque_produtos|does not exist|schema cache/i.test(msg);
}

function orgIdOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

function money(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function throwProdutoWrite(error) {
  if (missingTable(error)) {
    throw new Error("Rode o SQL supabase-estoque-portfolio-colar.sql no Supabase para cadastrar o portfólio.");
  }
  const code = String(error?.code || "");
  if (code === "PGRST116") {
    throw new Error("Não foi possível salvar o produto. Confira se você pertence a esta clínica.");
  }
  throw new Error(userFacingError(error, "Não foi possível salvar o produto."));
}

async function writeCatalogo(kind, row, filter) {
  const orgId = row.org_id;
  const attempt = async (payload) => {
    if (kind === "insert") {
      return supabase.from("estoque_produtos").insert(payload).select().single();
    }
    let q = supabase.from("estoque_produtos").update(payload).eq("org_id", orgId);
    if (filter?.id) q = q.eq("id", filter.id);
    return q.select().single();
  };
  let payload = { ...row };
  let data;
  let error;
  for (let i = 0; i < 16; i++) {
    ({ data, error } = await attempt(payload));
    if (!error) return { data, error };
    if (missingTable(error)) return { data, error };
    const next = stripUnknownColumn(payload, error, { immutable: ["id", "org_id", "nome"] });
    if (!next) return { data, error };
    payload = next;
  }
  return { data, error };
}

export async function listProdutosCatalogo() {
  const orgId = getActiveOrg();
  if (!orgId) return [];
  let q = supabase
    .from("estoque_produtos")
    .select("*")
    .eq("org_id", orgId)
    .order("nome", { ascending: true });
  let { data, error } = await q.eq("ativo", true);
  if (error && isUnknownColumnError(error) && /ativo/i.test(String(error.message || ""))) {
    const retry = await supabase
      .from("estoque_produtos")
      .select("*")
      .eq("org_id", orgId)
      .order("nome", { ascending: true });
    data = retry.data;
    error = retry.error;
  }
  if (error) {
    if (missingTable(error)) return [];
    throw error;
  }
  return data || [];
}

export async function upsertProdutoCatalogo(payload) {
  const orgId = orgIdOrThrow();
  const { data: { user } } = await supabase.auth.getUser();
  const nome = String(payload.nome || "").trim();
  if (!nome) throw new Error("Informe o nome do produto.");

  const row = {
    org_id: orgId,
    nome,
    custo_pago: money(payload.custo_pago),
    preco_profissional: money(payload.preco_profissional),
    preco_cliente: money(payload.preco_cliente),
    frete_padrao: money(payload.frete_padrao),
    validade_referencia: payload.validade_referencia || null,
    unidade: String(payload.unidade || "").trim() || null,
    quantidade_minima: money(payload.quantidade_minima),
    imagem_url: payload.imagem_url ? String(payload.imagem_url).trim() : payload.imagem_url === "" ? null : undefined,
    ativo: payload.ativo === false ? false : true,
    updated_at: new Date().toISOString(),
  };
  if (payload.observacao != null && String(payload.observacao).trim()) {
    row.observacao = String(payload.observacao).trim();
  }
  if (row.imagem_url === undefined) delete row.imagem_url;

  if (payload.id) {
    const { data, error } = await writeCatalogo("update", row, { id: payload.id });
    if (error) throwProdutoWrite(error);
    return data;
  }

  const { data: existing } = await supabase
    .from("estoque_produtos")
    .select("id")
    .eq("org_id", orgId)
    .ilike("nome", nome)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await writeCatalogo("update", row, { id: existing.id });
    if (error) throwProdutoWrite(error);
    return data;
  }

  row.created_by = user?.id ?? null;
  const { data, error } = await writeCatalogo("insert", row);
  if (error) throwProdutoWrite(error);
  return data;
}

export async function garantirCatalogoPorNome(nome) {
  const n = String(nome || "").trim();
  if (!n) return null;
  try {
    const lista = await listProdutosCatalogo();
    const hit = lista.find((p) => String(p.nome || "").toLowerCase() === n.toLowerCase());
    if (hit) return hit;
    return await upsertProdutoCatalogo({ nome: n });
  } catch {
    return null;
  }
}

export function custoMedioComFreteDasEntradas(entradas) {
  const by = {};
  for (const e of entradas || []) {
    const nome = String(e.produto_nome || "").trim();
    if (!nome) continue;
    if (!by[nome]) by[nome] = { qty: 0, total: 0 };
    const qty = Number(e.quantidade) || 0;
    const unit = custoUnitarioComFrete({
      valorUnitario: e.valor_unitario,
      valorTotal: e.valor_total,
      quantidade: qty,
      valorFrete: e.valor_frete,
    });
    if (qty > 0 && unit != null) {
      by[nome].qty += qty;
      by[nome].total += unit * qty;
    }
  }
  const out = {};
  for (const [nome, v] of Object.entries(by)) {
    out[nome] = v.qty > 0 ? v.total / v.qty : null;
  }
  return out;
}

export async function resolveProdutoImagemUrl(stored) {
  if (!stored) return null;
  if (/^https?:\/\//i.test(String(stored))) return String(stored);
  return signedStorageUrl("client-photos", stored);
}

export async function uploadProdutoImagem(file, produtoId) {
  const orgId = orgIdOrThrow();
  if (!file || !orgId) throw new Error("Arquivo de imagem inválido");
  const id = String(produtoId || crypto.randomUUID());
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safe = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
  const path = `${orgId}/produtos/${id}.${safe}`;
  const { error } = await supabase.storage.from("client-photos").upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}
