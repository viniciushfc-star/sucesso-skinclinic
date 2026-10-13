/**
 * Cadastro da empresa (perfil da organização).
 * Referência única: marketing (região), identidade (logo), futura nota (CNPJ/endereço).
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";
import { mergeCanalVenda, writeCanalVendaLocal, normalizeCanalVenda } from "../utils/canal-venda.js";
import { retryUnknownColumns } from "../utils/supabase-unknown-col.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

const PARCELADO_COLS = Array.from({ length: 11 }, (_, i) => `taxa_parcelado_${i + 2}_pct`).join(", ");
const PROFILE_STEP2 = "cidade, estado, logo_url, endereco, cnpj, telefone";
const PROFILE_STEP3 = "cep, complemento, menu_anamnese_visible, brinde_aniversario_habilitado, nota_fiscal_emitir_url";
const PROFILE_STEP4 = "taxa_avista_pct, taxa_parcelado_2_6_pct, taxa_parcelado_7_12_pct";
const PROFILE_TAXAS = "taxa_transacao_pct, taxa_avista_debito_pct, taxa_avista_credito_pct, " + PARCELADO_COLS;
const PROFILE_TAXAS_BANDEIRAS = "taxas_bandeiras";
const PROFILE_PARCELAMENTO = "parcelamento_margem_minima_pct, parcelamento_max_parcelas";
const PROFILE_MARGEM_COMISSAO = "margem_alvo_padrao_pct, comissao_profissional_padrao_pct";
const PROFILE_CRM = "google_review_url, fidelidade_visitas";
const PROFILE_CANAL = "vende_para_cliente, vende_para_profissional";

const PARCELADO_NULLS = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`taxa_parcelado_${i + 2}_pct`, null]));
const TAXAS_EXTRA_NULLS = { taxa_transacao_pct: null, taxa_avista_debito_pct: null, taxa_avista_credito_pct: null };
const ALL_DEFAULTS = { cidade: null, estado: null, logo_url: null, endereco: null, cnpj: null, telefone: null, cep: null, complemento: null, menu_anamnese_visible: false, brinde_aniversario_habilitado: false, nota_fiscal_emitir_url: null, google_review_url: null, fidelidade_visitas: 10, taxa_avista_pct: null, taxa_parcelado_2_6_pct: null, taxa_parcelado_7_12_pct: null, taxas_bandeiras: null, parcelamento_margem_minima_pct: 80, parcelamento_max_parcelas: null, margem_alvo_padrao_pct: 40, comissao_profissional_padrao_pct: null, vende_para_cliente: true, vende_para_profissional: false, ...TAXAS_EXTRA_NULLS, ...PARCELADO_NULLS };

function crmLocalKey(orgId) {
  return `sc_crm_prefs:${orgId}`;
}

function mergeCrmLocal(orgId, result) {
  try {
    const local = JSON.parse(localStorage.getItem(crmLocalKey(orgId)) || "{}");
    if (!result.google_review_url && local.google_review_url) result.google_review_url = local.google_review_url;
    if (result.fidelidade_visitas == null && local.fidelidade_visitas) result.fidelidade_visitas = local.fidelidade_visitas;
  } catch (_) {}
  return result;
}

function saveCrmLocal(orgId, payload) {
  try {
    const prev = JSON.parse(localStorage.getItem(crmLocalKey(orgId)) || "{}");
    localStorage.setItem(
      crmLocalKey(orgId),
      JSON.stringify({
        google_review_url: payload.google_review_url ?? prev.google_review_url ?? "",
        fidelidade_visitas: payload.fidelidade_visitas ?? prev.fidelidade_visitas ?? 10,
      })
    );
  } catch (_) {}
}

/**
 * Retorna o perfil da organização ativa. Usa selects progressivos (mínimo primeiro) para evitar 400 quando colunas não existem.
 * Em caso de erro (400/404/conexão), retorna null para o app exibir banner e não quebrar.
 */
export async function getOrganizationProfile() {
  try {
    const orgId = getOrgOrThrow();
    const baseSelect = () => supabase.from("organizations").select("id, name").eq("id", orgId).single();

    const { data: d1, error: e1 } = await baseSelect();
    if (e1) return null;

    let result = { ...(d1 ?? {}), ...ALL_DEFAULTS };

    const trySelect = async (cols) => {
      const { data } = await supabase.from("organizations").select(cols).eq("id", orgId).single();
      return data;
    };

    const d2 = await trySelect(PROFILE_STEP2);
    if (d2) result = { ...result, ...d2 };
    const d3 = await trySelect(PROFILE_STEP3);
    if (d3) result = { ...result, ...d3 };
    const d4 = await trySelect(PROFILE_STEP4);
    if (d4) result = { ...result, ...d4 };
    const d5 = await trySelect(PROFILE_TAXAS);
    if (d5) result = { ...result, ...d5 };
    const d6 = await trySelect(PROFILE_TAXAS_BANDEIRAS);
    if (d6) result = { ...result, ...d6 };
    const d7 = await trySelect(PROFILE_PARCELAMENTO);
    if (d7) result = { ...result, ...d7 };
    const d8 = await trySelect(PROFILE_MARGEM_COMISSAO);
    if (d8) result = { ...result, ...d8 };
    const d9 = await trySelect(PROFILE_CRM);
    if (d9) result = { ...result, ...d9 };
    const dCanal = await trySelect(PROFILE_CANAL);
    if (dCanal && (dCanal.vende_para_profissional != null || dCanal.vende_para_cliente != null)) {
      result = { ...result, ...normalizeCanalVenda(dCanal) };
    } else {
      result = { ...result, ...mergeCanalVenda(result, orgId) };
    }

    return mergeCrmLocal(orgId, result);
  } catch (_) {
    return null;
  }
}

/**
 * Atualiza o perfil da organização (cadastro da empresa).
 */
export async function updateOrganizationProfile(payload) {
  const orgId = getOrgOrThrow();
  const { name, cidade, estado, logo_url, endereco, cep, complemento, cnpj, telefone, menu_anamnese_visible, taxa_transacao_pct, taxa_avista_pct, taxa_avista_debito_pct, taxa_avista_credito_pct, taxa_parcelado_2_6_pct, taxa_parcelado_7_12_pct, brinde_aniversario_habilitado, nota_fiscal_emitir_url, google_review_url, fidelidade_visitas, taxas_bandeiras, parcelamento_margem_minima_pct, parcelamento_max_parcelas, margem_alvo_padrao_pct, comissao_profissional_padrao_pct, vende_para_cliente, vende_para_profissional } = payload;
  const update = {};
  if (name !== undefined) update.name = (name || "").trim();
  if (cidade !== undefined) update.cidade = (cidade || "").trim() || null;
  if (estado !== undefined) update.estado = (estado || "").trim() || null;
  if (logo_url !== undefined) update.logo_url = (logo_url || "").trim() || null;
  if (endereco !== undefined) update.endereco = (endereco || "").trim() || null;
  if (cep !== undefined) update.cep = (cep || "").trim() || null;
  if (complemento !== undefined) update.complemento = (complemento || "").trim() || null;
  if (cnpj !== undefined) update.cnpj = (cnpj || "").trim() || null;
  if (telefone !== undefined) update.telefone = (telefone || "").trim() || null;
  if (menu_anamnese_visible !== undefined) update.menu_anamnese_visible = !!menu_anamnese_visible;
  if (taxa_transacao_pct !== undefined && taxa_transacao_pct !== "") update.taxa_transacao_pct = Number(taxa_transacao_pct) || null;
  if (taxa_avista_pct !== undefined && taxa_avista_pct !== "") update.taxa_avista_pct = Number(taxa_avista_pct) || null;
  if (taxa_avista_debito_pct !== undefined && taxa_avista_debito_pct !== "") update.taxa_avista_debito_pct = Number(taxa_avista_debito_pct) || null;
  if (taxa_avista_credito_pct !== undefined && taxa_avista_credito_pct !== "") update.taxa_avista_credito_pct = Number(taxa_avista_credito_pct) || null;
  if (taxa_parcelado_2_6_pct !== undefined && taxa_parcelado_2_6_pct !== "") update.taxa_parcelado_2_6_pct = Number(taxa_parcelado_2_6_pct) || null;
  if (taxa_parcelado_7_12_pct !== undefined && taxa_parcelado_7_12_pct !== "") update.taxa_parcelado_7_12_pct = Number(taxa_parcelado_7_12_pct) || null;
  for (let i = 2; i <= 12; i++) {
    const key = `taxa_parcelado_${i}_pct`;
    const val = payload[key];
    if (val !== undefined && val !== "") update[key] = Number(val) || null;
  }
  if (brinde_aniversario_habilitado !== undefined) update.brinde_aniversario_habilitado = !!brinde_aniversario_habilitado;
  if (nota_fiscal_emitir_url !== undefined) update.nota_fiscal_emitir_url = (nota_fiscal_emitir_url || "").trim() || null;
  if (taxas_bandeiras !== undefined) update.taxas_bandeiras = taxas_bandeiras && typeof taxas_bandeiras === "object" ? taxas_bandeiras : null;
  if (parcelamento_margem_minima_pct !== undefined && parcelamento_margem_minima_pct !== "") update.parcelamento_margem_minima_pct = Number(parcelamento_margem_minima_pct) || null;
  if (parcelamento_max_parcelas !== undefined) update.parcelamento_max_parcelas = (parcelamento_max_parcelas === "" || parcelamento_max_parcelas == null) ? null : (Math.min(12, Math.max(1, parseInt(parcelamento_max_parcelas, 10))) || null);
  if (margem_alvo_padrao_pct !== undefined && margem_alvo_padrao_pct !== "") update.margem_alvo_padrao_pct = Number(margem_alvo_padrao_pct) || null;
  if (comissao_profissional_padrao_pct !== undefined && comissao_profissional_padrao_pct !== "") update.comissao_profissional_padrao_pct = Number(comissao_profissional_padrao_pct) || null;
  if (google_review_url !== undefined) update.google_review_url = (google_review_url || "").trim() || null;
  if (fidelidade_visitas !== undefined && fidelidade_visitas !== "") {
    const n = parseInt(fidelidade_visitas, 10);
    update.fidelidade_visitas = Number.isFinite(n) ? Math.min(50, Math.max(3, n)) : 10;
  }
  if (vende_para_cliente !== undefined) update.vende_para_cliente = !!vende_para_cliente;
  if (vende_para_profissional !== undefined) update.vende_para_profissional = !!vende_para_profissional;
  if (vende_para_cliente !== undefined || vende_para_profissional !== undefined) {
    writeCanalVendaLocal(orgId, {
      vende_para_cliente: vende_para_cliente !== undefined ? !!vende_para_cliente : true,
      vende_para_profissional: !!vende_para_profissional,
    });
  }
  saveCrmLocal(orgId, { google_review_url: update.google_review_url, fidelidade_visitas: update.fidelidade_visitas });

  if (Object.keys(update).length === 0) {
    return mergeCrmLocal(orgId, (await getOrganizationProfile()) ?? {});
  }

  const { data, error } = await retryUnknownColumns(
    update,
    (row) => supabase.from("organizations").update(row).eq("id", orgId).select().single(),
    { immutable: ["name"] }
  );
  if (error) throw error;
  return mergeCrmLocal(orgId, data ?? {});
}

/**
 * Upload do logo da organização (Storage org-logos).
 * Caminho: org_id/logo.ext
 * Retorna a URL pública para salvar em logo_url.
 */
export async function uploadOrgLogo(file) {
  const orgId = getOrgOrThrow();
  if (!file || !orgId) throw new Error("Arquivo de logo inválido");

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${orgId}/logo.${ext}`;

  const { error } = await supabase.storage
    .from("org-logos")
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from("org-logos").getPublicUrl(path);
  return data?.publicUrl || null;
}
