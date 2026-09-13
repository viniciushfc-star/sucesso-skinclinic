import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";
import { getFinanceiro } from "./financeiro.service.js";
import { aliquotaSimplesAnexoIII } from "../constants/fiscal.js";

function lsKey(orgId) {
  return `sc_fiscal:${orgId}`;
}

function readLocal(orgId) {
  try {
    return JSON.parse(localStorage.getItem(lsKey(orgId)) || "{}");
  } catch (_) {
    return {};
  }
}

function writeLocal(orgId, patch) {
  const prev = readLocal(orgId);
  const next = { ...prev, ...patch };
  try {
    localStorage.setItem(lsKey(orgId), JSON.stringify(next));
  } catch (_) {}
  return next;
}

export async function getFiscalPrefs() {
  const orgId = getActiveOrg();
  const local = orgId ? readLocal(orgId) : {};
  const fallback = {
    name: "",
    cnpj: local.cnpj || "",
    regime_tributario: local.regime_tributario || "nao_informado",
    aliquota_simples_pct: local.aliquota_simples_pct ?? null,
  };
  if (!orgId) return fallback;
  const base = await supabase.from("organizations").select("id, name, cnpj").eq("id", orgId).maybeSingle();
  if (base.error || !base.data) return fallback;
  const extra = await supabase.from("organizations").select("regime_tributario, aliquota_simples_pct").eq("id", orgId).maybeSingle();
  const ext = extra.error ? {} : extra.data || {};
  return {
    name: base.data.name || "",
    cnpj: base.data.cnpj || local.cnpj || "",
    regime_tributario: ext.regime_tributario || local.regime_tributario || "nao_informado",
    aliquota_simples_pct:
      ext.aliquota_simples_pct != null ? Number(ext.aliquota_simples_pct) : local.aliquota_simples_pct ?? null,
  };
}

export async function saveFiscalPrefs(payload) {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  writeLocal(orgId, payload);
  const update = {};
  if (payload.regime_tributario !== undefined) update.regime_tributario = payload.regime_tributario || "nao_informado";
  if (payload.aliquota_simples_pct !== undefined) {
    update.aliquota_simples_pct =
      payload.aliquota_simples_pct === "" || payload.aliquota_simples_pct == null
        ? null
        : Number(payload.aliquota_simples_pct);
  }
  if (!Object.keys(update).length) return getFiscalPrefs();
  const { error } = await supabase.from("organizations").update(update).eq("id", orgId);
  if (error) {
    const msg = String(error.message || "");
    if (!msg.toLowerCase().includes("does not exist") && !msg.includes("regime_tributario") && !msg.includes("aliquota_simples")) {
      throw error;
    }
  }
  return getFiscalPrefs();
}

function ym(iso) {
  return String(iso || "").slice(0, 7);
}

export async function getApuracaoEstimativa(competenciaYm) {
  const ymKey = competenciaYm || new Date().toISOString().slice(0, 7);
  const [y, m] = ymKey.split("-").map(Number);
  const start = `${ymKey}-01`;
  const last = new Date(y, m, 0).getDate();
  const end = `${ymKey}-${String(last).padStart(2, "0")}`;
  const start12 = new Date(y, m - 12, 1).toISOString().slice(0, 10);

  const rows = await getFinanceiro();
  const noMes = (rows || []).filter((r) => r.data >= start && r.data <= end);
  const receitaMes = noMes
    .filter((r) => r.tipo === "entrada")
    .reduce((s, r) => s + (Number(r.valor_recebido ?? r.valor) || 0), 0);
  const despesaMes = noMes
    .filter((r) => r.tipo === "saida")
    .reduce((s, r) => s + (Number(r.valor) || 0), 0);
  const receita12 = (rows || [])
    .filter((r) => r.tipo === "entrada" && r.data >= start12 && r.data <= end)
    .reduce((s, r) => s + (Number(r.valor_recebido ?? r.valor) || 0), 0);

  const prefs = await getFiscalPrefs();
  const tabela = aliquotaSimplesAnexoIII(receita12);
  const aliquota = prefs.aliquota_simples_pct != null ? Number(prefs.aliquota_simples_pct) : tabela;
  const dasEstimado = (receitaMes * aliquota) / 100;

  return {
    competencia: ymKey,
    start,
    end,
    receitaMes,
    despesaMes,
    resultado: receitaMes - despesaMes,
    receita12,
    aliquotaTabela: tabela,
    aliquotaUsada: aliquota,
    dasEstimado,
    regime: prefs.regime_tributario,
    cnpj: prefs.cnpj,
    clinica: prefs.name,
  };
}

function csvCell(v) {
  const s = v == null ? "" : String(v);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function exportCsvContador(startDate, endDate) {
  const prefs = await getFiscalPrefs();
  const rows = (await getFinanceiro()).filter((r) => r.data >= startDate && r.data <= endDate);
  const header = [
    "competencia",
    "data",
    "tipo",
    "natureza",
    "descricao",
    "valor",
    "valor_recebido",
    "forma_pagamento",
    "cnpj_clinica",
    "regime",
  ];
  const lines = [header.join(";")];
  for (const r of rows) {
    lines.push(
      [
        ym(r.data),
        r.data,
        r.tipo,
        r.tipo === "entrada" ? "receita" : "despesa",
        csvCell(r.descricao),
        String(Number(r.valor) || 0).replace(".", ","),
        r.valor_recebido != null && r.valor_recebido !== "" ? String(Number(r.valor_recebido)).replace(".", ",") : "",
        r.forma_pagamento || "",
        csvCell(prefs.cnpj || ""),
        prefs.regime_tributario || "",
      ].join(";")
    );
  }
  return lines.join("\n");
}

export async function listFiscalDocuments() {
  const orgId = getActiveOrg();
  const local = (readLocal(orgId).docs || []);
  const { data, error } = await withOrg(
    supabase.from("fiscal_documents").select("*").order("created_at", { ascending: false })
  );
  if (error) return local;
  return data?.length ? data : local;
}

export async function addFiscalDocument(p) {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  const row = {
    org_id: orgId,
    tipo: p.tipo || "outros",
    titulo: String(p.titulo || "").trim() || "Documento",
    file_url: String(p.file_url || "").trim() || null,
    competencia: p.competencia || null,
    notes: String(p.notes || "").trim() || null,
  };
  const { data, error } = await supabase.from("fiscal_documents").insert(row).select().single();
  if (!error && data) return data;
  const local = readLocal(orgId);
  const docs = [{ ...row, id: `local-${Date.now()}` }, ...(local.docs || [])];
  writeLocal(orgId, { docs });
  if (error && !String(error.message || "").toLowerCase().includes("fiscal_documents")) throw error;
  return docs[0];
}

export async function saveApuracaoRascunho(est) {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  const payload = {
    org_id: orgId,
    competencia: `${est.competencia}-01`,
    regime: est.regime,
    receita_caixa: est.receitaMes,
    aliquota_usada: est.aliquotaUsada,
    imposto_estimado: est.dasEstimado,
    status: "rascunho",
  };
  const { error } = await supabase.from("fiscal_apuracoes").insert(payload);
  const local = readLocal(orgId);
  const apuracoes = { ...(local.apuracoes || {}), [est.competencia]: payload };
  writeLocal(orgId, { apuracoes });
  if (error && !String(error.message || "").includes("fiscal_apuracoes")) throw error;
}
