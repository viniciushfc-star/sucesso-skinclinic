import { supabase } from "../core/supabase.js";
import { withOrg, getActiveOrg } from "../core/org.js";
import { toast } from "../ui/toast.js";
import { checkPermission } from "../core/permissions.js";
import { getSession } from "../core/auth.js";

const PAGE_SIZE = 30;
const auditLogsState = { allRows: [], offset: 0, hasMore: false };

/* =====================
   SPA INIT
===================== */

export function init() {
  document.getElementById("logsFilterAck")?.addEventListener("change", () => { auditLogsState.allRows = []; auditLogsState.offset = 0; renderLogs(); });
  document.getElementById("logsFilterPeriod")?.addEventListener("change", () => { auditLogsState.allRows = []; auditLogsState.offset = 0; renderLogs(); });
  document.getElementById("logsFilterType")?.addEventListener("change", () => { auditLogsState.allRows = []; auditLogsState.offset = 0; renderLogs(); });
  document.getElementById("btnExportarAuditoriaCsv")?.addEventListener("click", exportarAuditoriaCsv);
  document.getElementById("btnLogsLoadMore")?.addEventListener("click", loadMoreLogs);
  renderLogs();
}

/* =====================
   RENDER
===================== */

export async function renderLogs() {
  const listaLogs = document.getElementById("listaLogs");
  if (!listaLogs) return;

  try {
    const orgId = getActiveOrg();
    if (!orgId) {
      listaLogs.innerHTML = "<p class=\"logs-forbidden\">Selecione uma organização para ver a auditoria.</p>";
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast("Sessão expirada");
      window.location.href = "/index.html";
      return;
    }

    const canViewLogs = await checkPermission("auditoria:view");
    if (!canViewLogs) {
      listaLogs.innerHTML = "<p class=\"logs-forbidden\">Sem permissão para ver a auditoria. Master e gestor podem visualizar.</p>";
      return;
    }

    const canAck = await checkPermission("auditoria:acknowledge");
    const filterAck = document.getElementById("logsFilterAck")?.value || "all";
    const filterPeriod = document.getElementById("logsFilterPeriod")?.value || "all";
    const filterType = document.getElementById("logsFilterType")?.value || "all";

    const isLoadMore = auditLogsState.allRows.length > 0 && auditLogsState.offset > 0;
    if (!isLoadMore) {
      auditLogsState.allRows = [];
      auditLogsState.offset = 0;
    }

    let q = supabase
      .from("audit_logs")
      .select(`
        id,
        action,
        table_name,
        record_id,
        user_email,
        role_technical,
        job_title,
        permission_used,
        metadata,
        created_at,
        acknowledged_by,
        acknowledged_at,
        acknowledged_by_email,
        starred_by,
        starred_at,
        starred_by_email
      `)
      .order("created_at", { ascending: false })
      .range(auditLogsState.offset, auditLogsState.offset + PAGE_SIZE - 1);

    q = withOrg(q);

    if (filterType !== "all" && filterType !== "outros") {
      const pattern = getActionPatternForType(filterType);
      if (pattern) q = q.ilike("action", pattern);
    }

    if (filterPeriod === "7") {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      q = q.gte("created_at", since.toISOString());
    } else if (filterPeriod === "30") {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      q = q.gte("created_at", since.toISOString());
    }

    const { data, error } = await q;

    if (error) throw error;

    const page = data || [];
    auditLogsState.hasMore = page.length >= PAGE_SIZE;
    auditLogsState.offset += page.length;
    auditLogsState.allRows = auditLogsState.allRows.concat(page);

    let rows = auditLogsState.allRows;
    if (filterAck === "pending") {
      rows = rows.filter((l) => !l.acknowledged_at);
    }

    const emptyMsg = rows.length === 0
      ? (filterAck === "pending" ? "Nenhum item pendente de ok." : filterPeriod !== "all" ? "Nenhum registro no período." : "Nenhum registro de auditoria ainda.")
      : null;

    listaLogs.innerHTML = emptyMsg
      ? `<p class="logs-empty">${emptyMsg}</p>`
      : rows.map((l) => {
          const userLabel = l.metadata?.completed_by_client
            ? "Cliente: " + escapeHtml(l.metadata?.client_name || l.record_id || "—") + " (completou cadastro)"
            : escapeHtml(l.user_email || "sistema");
          const severity = getSeverity(l);
          const isStarred = !!l.starred_at;
          const okLine = l.acknowledged_at
            ? `<div class="logs-item-ok">✓ Ok por ${escapeHtml(l.acknowledged_by_email || "gestor")} em ${new Date(l.acknowledged_at).toLocaleString("pt-BR")}</div>`
            : "";
          const btnOk = canAck && !l.acknowledged_at
            ? ` <button type="button" class="btn-secondary btn-sm btn-log-ok" data-id="${l.id}" title="Registrar que o gestor deu ok">Dar ok</button>`
            : "";
          const canStar = canAck;
          const starBtn = canStar
            ? `<button type="button" class="logs-star-btn" data-id="${l.id}" data-starred="${isStarred ? "1" : "0"}" title="${
                isStarred ? "Remover estrela" : "Marcar como importante"
              }">${isStarred ? "★" : "☆"}</button>`
            : "";
          return `
  <div class="logs-item logs-item--${severity}" data-id="${l.id}">
    <div class="logs-item-header">
      <span class="logs-item-action">${escapeHtml(l.action)}</span>${starBtn}${btnOk}
    </div>
    <div class="logs-item-body">
      <span class="logs-item-meta"><strong>Usuário:</strong> ${userLabel}</span>
      <span class="logs-item-meta"><strong>Cargo:</strong> ${escapeHtml(l.job_title || "—")} (${escapeHtml(l.role_technical || "—")})</span>
      <span class="logs-item-meta"><strong>Permissão:</strong> ${escapeHtml(l.permission_used || "—")}</span>
      <span class="logs-item-meta"><strong>Tabela:</strong> ${escapeHtml(l.table_name || "—")}</span>
      <span class="logs-item-meta"><strong>Registro:</strong> ${escapeHtml(l.record_id || "—")}</span>
      <span class="logs-item-date">${new Date(l.created_at).toLocaleString("pt-BR")}</span>
      ${okLine}
    </div>
  </div>`;
        }).join("");

    document.querySelectorAll(".btn-log-ok").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const id = btn.dataset.id;
        if (!id) return;
        await acknowledgeLog(id);
      });
    });
    document.querySelectorAll(".logs-star-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        const id = btn.dataset.id;
        if (!id) return;
        const current = btn.dataset.starred === "1";
        await toggleStar(id, current);
      });
    });

    const loadMoreWrap = document.getElementById("logsLoadMoreWrap");
    const btnLoadMore = document.getElementById("btnLogsLoadMore");
    if (loadMoreWrap && btnLoadMore) {
      if (auditLogsState.hasMore) {
        loadMoreWrap.classList.remove("hidden");
        loadMoreWrap.querySelector("button")?.focus();
      } else {
        loadMoreWrap.classList.add("hidden");
      }
    }
  } catch (err) {
    console.error("[LOGS] erro render", err);
    auditLogsState.allRows = [];
    auditLogsState.offset = 0;
    auditLogsState.hasMore = false;
    const loadMoreWrap = document.getElementById("logsLoadMoreWrap");
    if (loadMoreWrap) loadMoreWrap.classList.add("hidden");
    const code = err?.code || "";
    const msg = (err?.message || "").toString();
    const status = err?.status || err?.response?.status;
    const isRlsOrConfig =
      status === 400 ||
      status === 403 ||
      /PGRST|RLS|permission|policy|app\.org_id|configuration parameter|42704/i.test(code + " " + msg);
    if (listaLogs && isRlsOrConfig) {
      listaLogs.innerHTML = `
        <p class="logs-forbidden">
          Não foi possível carregar a auditoria. A tabela <code>audit_logs</code> ou as políticas RLS podem não estar configuradas no Supabase.
          Se o erro mencionar <code>app.org_id</code>, verifique se os scripts de auditoria foram executados no projeto (ex.: <code>supabase-audit-logs-rls-fix.sql</code>).
        </p>
      `;
    } else {
      toast("Erro ao carregar logs");
    }
  }
}

async function loadMoreLogs() {
  auditLogsState.offset = auditLogsState.allRows.length;
  await renderLogs();
}

function exportarAuditoriaCsv() {
  const filterAck = document.getElementById("logsFilterAck")?.value || "all";
  let rows = auditLogsState.allRows || [];
  if (filterAck === "pending") rows = rows.filter((l) => !l.acknowledged_at);
  if (rows.length === 0) {
    toast("Nenhum registro para exportar. Ajuste os filtros ou carregue mais.");
    return;
  }
  const headers = ["Data", "Ação", "Usuário", "Cargo", "Permissão", "Tabela", "Registro", "Ok em"];
  const lines = rows.map((l) => {
    const userLabel = l.metadata?.completed_by_client ? "Cliente (cadastro)" : (l.user_email || "");
    const okEm = l.acknowledged_at ? new Date(l.acknowledged_at).toLocaleString("pt-BR") : "";
    return [
      new Date(l.created_at).toLocaleString("pt-BR"),
      escapeCsv(l.action || ""),
      escapeCsv(userLabel),
      escapeCsv((l.job_title || "") + " (" + (l.role_technical || "") + ")"),
      escapeCsv(l.permission_used || ""),
      escapeCsv(l.table_name || ""),
      escapeCsv(String(l.record_id || "")),
      escapeCsv(okEm),
    ].join(";");
  });
  const csv = "\uFEFF" + headers.join(";") + "\n" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "auditoria_" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click();
  URL.revokeObjectURL(a.href);
  toast("CSV exportado");
}

function escapeCsv(s) {
  const t = String(s).replace(/"/g, '""');
  return t.includes(";") || t.includes("\n") || t.includes('"') ? `"${t}"` : t;
}

async function acknowledgeLog(auditId) {
  const orgId = getActiveOrg();
  const session = await getSession();
  const user = session?.user;
  if (!orgId || !user) {
    toast("Sessão inválida");
    return;
  }

  try {
    const { error } = await withOrg(
      supabase
        .from("audit_logs")
        .update({
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString(),
          acknowledged_by_email: user.email || "",
        })
        .eq("id", auditId)
    );

    if (error) throw error;
    toast("Ok registrado");
    renderLogs();
  } catch (err) {
    console.error("[LOGS] acknowledge", err);
    toast(err?.message || "Erro ao registrar ok");
  }
}

async function toggleStar(auditId, currentStarred) {
  const orgId = getActiveOrg();
  const session = await getSession();
  const user = session?.user;
  if (!orgId || !user) {
    toast("Sessão inválida");
    return;
  }

  try {
    const payload = currentStarred
      ? { starred_by: null, starred_at: null, starred_by_email: null }
      : {
          starred_by: user.id,
          starred_at: new Date().toISOString(),
          starred_by_email: user.email || "",
        };

    const { error } = await withOrg(
      supabase.from("audit_logs").update(payload).eq("id", auditId)
    );

    if (error) throw error;
    toast(currentStarred ? "Estrela removida" : "Marcado como importante");
    renderLogs();
  } catch (err) {
    console.error("[LOGS] toggleStar", err);
    toast(err?.message || "Erro ao atualizar estrela");
  }
}

/** Classifica severidade para cor do card. */
function getSeverity(l) {
  const action = String(l.action || "").toLowerCase();
  const perm = String(l.permission_used || "").toLowerCase();

  // Alta: clientes sensíveis, equipe, permissões, remoções
  if (
    action.includes("cliente.state_change") ||
    action.includes("cliente.update") ||
    perm.startsWith("clientes:edit") ||
    action.includes("team.remove") ||
    action.includes("team.permissions") ||
    action.includes("team.accept_invite")
  ) {
    return "high";
  }

  // Média: financeiro, protocolos, estoque, agenda
  if (
    action.includes("financeiro") ||
    perm.startsWith("financeiro:") ||
    action.includes("protocolo") ||
    action.includes("estoque") ||
    action.includes("agenda.")
  ) {
    return "medium";
  }

  return "low";
}

/** Retorna padrão para .ilike("action", pattern) conforme o tipo selecionado (financeiro, cliente, etc.). */
function getActionPatternForType(type) {
  const map = {
    financeiro: "%financeiro%",
    cliente: "%cliente%",
    procedimento: "%procedimento%",
    agenda: "%agenda%",
    equipe: "%team%",
    estoque: "%estoque%",
  };
  return map[type] || null;
}

function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = String(s);
  return div.innerHTML;
}
