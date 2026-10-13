import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";
import { apiFetch } from "../core/api-fetch.js";

/**
 * Registra um evento de auditoria de negócio
 * Nunca deve quebrar o fluxo da aplicação
 */
export async function audit({
  action,
  tableName = null,
  recordId = null,
  permissionUsed = null,
  metadata = {}
}) {
  try {
    const orgId = getActiveOrg();
    if (!orgId) return;

    await apiFetch("/api/audit-log", {
      method: "POST",
      json: {
        action,
        tableName,
        recordId,
        permissionUsed,
        metadata,
      },
    });

  } catch (err) {
    // auditoria nunca deve quebrar o sistema
    console.warn("[AUDIT SERVICE]", err);
  }
}

/**
 * Lista alertas de margem em risco (custo aumentou ≥15%) para exibir em Financeiro/Procedimentos.
 * Últimos 30 dias, action = estoque.custo_aumentou.
 */
export async function getMargemEmRisco(dias = 30) {
  try {
    const orgId = getActiveOrg();
    if (!orgId) return [];

    const since = new Date();
    since.setDate(since.getDate() - dias);
    // ISO sem milissegundos para evitar 400 no PostgREST (ponto em .559Z é reservado na URL)
    const sinceStr = since.toISOString().replace(/\.\d{3}Z$/, "Z");

    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, action, metadata, created_at")
      .eq("org_id", orgId)
      .eq("action", "estoque.custo_aumentou")
      .gte("created_at", sinceStr)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return [];
    const rows = (data || []).map((row) => ({
      id: row.id,
      produto_nome: row.metadata?.produto_nome || "—",
      variacao_percentual: row.metadata?.variacao_percentual ?? 0,
      custo_novo: row.metadata?.custo_novo,
      custo_medio_anterior: row.metadata?.custo_medio_anterior,
      created_at: row.created_at,
      metadata: row.metadata,
      procedimentos: [],
      impactos: [],
    }));
    try {
      const { listAllProcedureStockUsage, listProcedures } = await import("./procedimentos.service.js");
      const { getResumoPorProduto } = await import("./estoque-entradas.service.js");
      const { enriquecerAlertasMargem } = await import("../utils/margem-risco.js");
      const [usages, procedures, resumo] = await Promise.all([
        listAllProcedureStockUsage(),
        listProcedures(false),
        getResumoPorProduto().catch(() => []),
      ]);
      const custoMedioByName = {};
      for (const r of resumo || []) {
        const n = String(r.produto_nome || "").trim().toLowerCase();
        if (n && r.custo_medio != null && Number.isFinite(Number(r.custo_medio))) {
          custoMedioByName[n] = Number(r.custo_medio);
        }
      }
      return enriquecerAlertasMargem(rows, { procedures, usages, custoMedioByName });
    } catch (_) {
      return rows;
    }
  } catch (err) {
    console.warn("[AUDIT SERVICE] getMargemEmRisco", err);
    return [];
  }
}
