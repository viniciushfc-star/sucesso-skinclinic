/**
 * Cadastro da empresa (perfil da organização).
 * Referência única: marketing (região), identidade (logo), futura nota (CNPJ/endereço).
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";

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

const PARCELADO_NULLS = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`taxa_parcelado_${i + 2}_pct`, null]));
const TAXAS_EXTRA_NULLS = { taxa_transacao_pct: null, taxa_avista_debito_pct: null, taxa_avista_credito_pct: null };
const ALL_DEFAULTS = { cidade: null, estado: null, logo_url: null, endereco: null, cnpj: null, telefone: null, cep: null, complemento: null, menu_anamnese_visible: false, brinde_aniversario_habilitado: false, nota_fiscal_emitir_url: null, taxa_avista_pct: null, taxa_parcelado_2_6_pct: null, taxa_parcelado_7_12_pct: null, ...TAXAS_EXTRA_NULLS, ...PARCELADO_NULLS };

/**
 * Retorna o perfil da organização ativa. Usa selects progressivos (mínimo primeiro) para evitar 400 quando colunas não existem.
 */
export async function getOrganizationProfile() {
  const orgId = getOrgOrThrow();
  const baseSelect = () => supabase.from("organizations").select("id, name").eq("id", orgId).single();

  const { data: d1, error: e1 } = await baseSelect();
  if (e1) throw e1;

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

  return result;
}

/**
 * Atualiza o perfil da organização (cadastro da empresa).
 */
export async function updateOrganizationProfile(payload) {
  const orgId = getOrgOrThrow();
  const { name, cidade, estado, logo_url, endereco, cep, complemento, cnpj, telefone, menu_anamnese_visible, taxa_transacao_pct, taxa_avista_pct, taxa_avista_debito_pct, taxa_avista_credito_pct, taxa_parcelado_2_6_pct, taxa_parcelado_7_12_pct, brinde_aniversario_habilitado, nota_fiscal_emitir_url } = payload;
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

  const { data, error } = await supabase
    .from("organizations")
    .update(update)
    .eq("id", orgId)
    .select()
    .single();

  if (!error) return data;

  const msg = (error.message || "") + (error.details ? String(error.details) : "");
  const isMissingColumn =
    msg.includes("menu_anamnese_visible") || (msg.includes("column") && msg.toLowerCase().includes("does not exist"));

  if (isMissingColumn && "menu_anamnese_visible" in update) {
    delete update.menu_anamnese_visible;
    if (Object.keys(update).length === 0) return (await getOrganizationProfile()) ?? data;
    const { data: ret, error: err2 } = await supabase
      .from("organizations")
      .update(update)
      .eq("id", orgId)
      .select()
      .single();
    if (err2) throw err2;
    return { ...(ret ?? {}), menu_anamnese_visible: payload.menu_anamnese_visible };
  }

  const isTaxasNovasUpdate = msg.includes("taxa_transacao") || msg.includes("taxa_avista_debito") || msg.includes("taxa_avista_credito");
  if (isTaxasNovasUpdate && ("taxa_transacao_pct" in update || "taxa_avista_debito_pct" in update || "taxa_avista_credito_pct" in update)) {
    delete update.taxa_transacao_pct;
    delete update.taxa_avista_debito_pct;
    delete update.taxa_avista_credito_pct;
    if (Object.keys(update).length === 0) return (await getOrganizationProfile()) ?? data;
    const { data: retTaxas, error: errTaxas } = await supabase
      .from("organizations")
      .update(update)
      .eq("id", orgId)
      .select()
      .single();
    if (errTaxas) throw errTaxas;
    return { ...(retTaxas ?? {}), taxa_transacao_pct: payload.taxa_transacao_pct ?? null, taxa_avista_debito_pct: payload.taxa_avista_debito_pct ?? null, taxa_avista_credito_pct: payload.taxa_avista_credito_pct ?? null };
  }

  const isTaxaParceladoNUpdate = /taxa_parcelado_\d+_pct/.test(msg);
  if (isTaxaParceladoNUpdate) {
    for (let i = 2; i <= 12; i++) delete update[`taxa_parcelado_${i}_pct`];
    if (Object.keys(update).length === 0) return (await getOrganizationProfile()) ?? data;
    const { data: retP, error: errP } = await supabase.from("organizations").update(update).eq("id", orgId).select().single();
    if (errP) throw errP;
    const parceladoPayload = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`taxa_parcelado_${i + 2}_pct`, payload[`taxa_parcelado_${i + 2}_pct`] ?? null]));
    return { ...(retP ?? {}), ...parceladoPayload };
  }

  const isTaxasColumn = (msg.includes("taxa_avista") || msg.includes("taxa_parcelado")) || (isMissingColumn && ("taxa_avista_pct" in update || "taxa_parcelado_2_6_pct" in update || "taxa_parcelado_7_12_pct" in update));
  if (isTaxasColumn) {
    delete update.taxa_avista_pct;
    delete update.taxa_parcelado_2_6_pct;
    delete update.taxa_parcelado_7_12_pct;
    delete update.taxa_transacao_pct;
    delete update.taxa_avista_debito_pct;
    delete update.taxa_avista_credito_pct;
    for (let i = 2; i <= 12; i++) delete update[`taxa_parcelado_${i}_pct`];
    if (Object.keys(update).length === 0) return (await getOrganizationProfile()) ?? data;
    const { data: ret2, error: err3 } = await supabase
      .from("organizations")
      .update(update)
      .eq("id", orgId)
      .select()
      .single();
    if (err3) throw err3;
    return ret2 ?? data;
  }

  const isBrindeUpdate = msg.includes("brinde_aniversario") && "brinde_aniversario_habilitado" in update;
  if (isBrindeUpdate) {
    delete update.brinde_aniversario_habilitado;
    if (Object.keys(update).length === 0) return (await getOrganizationProfile()) ?? data;
    const { data: retB, error: errB } = await supabase
      .from("organizations")
      .update(update)
      .eq("id", orgId)
      .select()
      .single();
    if (errB) throw errB;
    return { ...(retB ?? {}), brinde_aniversario_habilitado: payload.brinde_aniversario_habilitado };
  }

  const isNotaFiscalUrlUpdate = msg.includes("nota_fiscal_emitir_url") && "nota_fiscal_emitir_url" in update;
  if (isNotaFiscalUrlUpdate) {
    delete update.nota_fiscal_emitir_url;
    if (Object.keys(update).length === 0) return (await getOrganizationProfile()) ?? data;
    const { data: retNf, error: errNf } = await supabase
      .from("organizations")
      .update(update)
      .eq("id", orgId)
      .select()
      .single();
    if (errNf) throw errNf;
    return { ...(retNf ?? {}), nota_fiscal_emitir_url: payload.nota_fiscal_emitir_url };
  }

  const isCepUpdate = msg.includes("cep") || msg.includes("complemento");
  if (isCepUpdate && ("cep" in update || "complemento" in update)) {
    delete update.cep;
    delete update.complemento;
    if (Object.keys(update).length === 0) return (await getOrganizationProfile()) ?? data;
    const { data: retCep, error: errCep } = await supabase
      .from("organizations")
      .update(update)
      .eq("id", orgId)
      .select()
      .single();
    if (errCep) throw errCep;
    return { ...(retCep ?? {}), cep: payload.cep ?? null, complemento: payload.complemento ?? null };
  }

  throw error;
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
