import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";
import { custoUnitarioComFrete } from "../utils/estoque-revenda.js";

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

function missingMinimo(error) {
  return /quantidade_minima|schema cache|column/i.test(String(error?.message || ""));
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
  let { data, error } = await attempt(row);
  if (error && missingMinimo(error) && Object.prototype.hasOwnProperty.call(row, "quantidade_minima")) {
    const copy = { ...row };
    delete copy.quantidade_minima;
    const retry = await attempt(copy);
    data = retry.data;
    error = retry.error;
  }
  return { data, error };
}

export async function listProdutosCatalogo() {
  const orgId = getActiveOrg();
  if (!orgId) return [];
  const { data, error } = await supabase
    .from("estoque_produtos")
    .select("*")
    .eq("org_id", orgId)
    .eq("ativo", true)
    .order("nome", { ascending: true });
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
    observacao: String(payload.observacao || "").trim() || null,
    quantidade_minima: money(payload.quantidade_minima),
    ativo: payload.ativo === false ? false : true,
    updated_at: new Date().toISOString(),
    created_by: user?.id ?? null,
  };

  if (payload.id) {
    const { data, error } = await writeCatalogo("update", row, { id: payload.id });
    if (error) throw error;
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
    if (error) throw error;
    return data;
  }

  const { data, error } = await writeCatalogo("insert", row);
  if (error) {
    if (missingTable(error)) {
      throw new Error("Rode o SQL supabase-estoque-portfolio-colar.sql no Supabase para cadastrar o portfólio.");
    }
    throw error;
  }
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
