/**
 * Restauração não destrutiva: nunca apaga; força org atual; pula o que já existe.
 */

export const BACKUP_TABLES = ["clients", "agenda", "financeiro"];

export function financeFingerprint(row) {
  const data = String(row?.data || "").slice(0, 10);
  const tipo = String(row?.tipo || "").toLowerCase();
  const valor = Number(row?.valor);
  const desc = String(row?.descricao || "").trim().toLowerCase();
  return `${data}|${tipo}|${Number.isFinite(valor) ? valor : ""}|${desc}`;
}

export function agendaFingerprint(row) {
  const data = String(row?.data || "").slice(0, 10);
  const hora = String(row?.hora || "").slice(0, 5);
  return `${data}|${hora}`;
}

export function sanitizeRawTableRows(rows, orgId) {
  const ready = [];
  let skippedForeign = 0;
  for (const r of rows || []) {
    if (!r || typeof r !== "object") continue;
    if (r.org_id && orgId && String(r.org_id) !== String(orgId)) {
      skippedForeign += 1;
      continue;
    }
    ready.push({ ...r, org_id: orgId });
  }
  return { ready, skippedForeign };
}

export function filterNewById(rows, existingIds) {
  const skip = new Set((existingIds || []).map(String));
  const insert = [];
  let skippedExisting = 0;
  for (const r of rows || []) {
    if (r?.id && skip.has(String(r.id))) {
      skippedExisting += 1;
      continue;
    }
    insert.push(r);
  }
  return { insert, skippedExisting };
}

export function previewBackupUnico(data) {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Arquivo JSON inválido" };
  }
  const n = (k) => (Array.isArray(data[k]) ? data[k].length : 0);
  return {
    ok: true,
    clientes: n("clientes"),
    procedimentos: n("procedimentos"),
    financeiro: n("financeiro"),
    custo_fixo: n("custo_fixo"),
    agenda: n("agenda"),
    aviso:
      "Não apaga o que já existe. Duplicados (CPF, e-mail, nome do procedimento, mesmo lançamento ou mesmo horário) são ignorados.",
  };
}

export function formatRestoreSummary(out) {
  const labels = {
    clientes: "Clientes",
    procedimentos: "Procedimentos",
    financeiro: "Financeiro",
    custo_fixo: "Custo fixo",
    agenda: "Agenda",
    clients: "Clientes",
  };
  const parts = [];
  for (const [k, v] of Object.entries(out || {})) {
    if (!v || typeof v !== "object") continue;
    const ins = v.inseridos || 0;
    const ign = v.ignorados_duplicados || 0;
    const other = v.ignorados_outra_org || 0;
    let s = `${labels[k] || k}: ${ins} novo(s)`;
    if (ign) s += `, ${ign} já existiam`;
    if (other) s += `, ${other} de outra clínica ignorados`;
    parts.push(s);
  }
  return parts;
}

export function confirmRestoreMessage(preview) {
  const parts = [
    `${preview.clientes} cliente(s)`,
    `${preview.procedimentos} procedimento(s)`,
    `${preview.financeiro} lançamento(s)`,
    `${preview.agenda} horário(s)`,
  ];
  return (
    "Restaurar nesta clínica?\n\n" +
    parts.join("\n") +
    "\n\nSó entra o que ainda não existe. Nada é apagado."
  );
}
