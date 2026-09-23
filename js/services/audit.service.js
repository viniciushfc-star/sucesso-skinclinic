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
    const { getProcedimentosQueUsamProduto } = await import("./estoque-entradas.service.js");
    const byProduct = new Map();
    const rows = [];
    for (const row of data || []) {
      const produto_nome = row.metadata?.produto_nome || "—";
      const key = String(produto_nome).toLowerCase();
      if (!byProduct.has(key)) {
        try {
          byProduct.set(key, await getProcedimentosQueUsamProduto(produto_nome));
        } catch (_) {
          byProduct.set(key, []);
        }
      }
      rows.push({
        id: row.id,
        produto_nome,
        variacao_percentual: row.metadata?.variacao_percentual ?? 0,
        custo_novo: row.metadata?.custo_novo,
        created_at: row.created_at,
        procedimentos: byProduct.get(key) || [],
      });
    }
    return rows;
  } catch (err) {
    console.warn("[AUDIT SERVICE] getMargemEmRisco", err);
    return [];
  }
}
