import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";
import { getSession } from "../core/auth.js";
import { getRole } from "./permissions.service.js";

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

    const session = await getSession();
    const user = session?.user;
    if (!user) return;

    const role = await getRole();

    await supabase.from("audit_logs").insert({
      org_id: orgId,
      user_id: user.id,
      user_email: user.email,

      role_technical: role,
      job_title: metadata.job_title || null,

      action,
      table_name: tableName,
      record_id: recordId,

      permission_used: permissionUsed,
      metadata
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

    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, action, metadata, created_at")
      .eq("org_id", orgId)
      .eq("action", "estoque.custo_aumentou")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return [];
    return (data || []).map((row) => ({
      id: row.id,
      produto_nome: row.metadata?.produto_nome || "—",
      variacao_percentual: row.metadata?.variacao_percentual ?? 0,
      custo_novo: row.metadata?.custo_novo,
      created_at: row.created_at,
    }));
  } catch (err) {
    console.warn("[AUDIT SERVICE] getMargemEmRisco", err);
    return [];
  }
}
