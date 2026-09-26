/**
 * Saúde operacional: P95, falha de login (sem e-mail) e job.
 * Sem amostra → não informado. Não inventa latência.
 */

export function percentil(values, p) {
  const nums = (values || [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 0)
    .sort((a, b) => a - b);
  if (!nums.length) return null;
  const rank = Math.ceil((Number(p) / 100) * nums.length) - 1;
  return nums[Math.min(nums.length - 1, Math.max(0, rank))];
}

export function p95Ms(values) {
  return percentil(values, 95);
}

export function resumoLatencia(samples) {
  const list = Array.isArray(samples) ? samples : [];
  const p95 = p95Ms(list);
  if (p95 == null) {
    return { n: 0, p95Ms: null, fonte: "", texto: "P95: não informado (sem amostra neste isolate)." };
  }
  return {
    n: list.length,
    p95Ms: p95,
    fonte: `amostra em memória deste isolate (${list.length} requests /api)`,
    texto: `P95: ${p95} ms. Fonte: amostra em memória deste isolate (${list.length} requests /api).`,
  };
}

export function resumoLoginFail({ n = 0, lastAt = null } = {}) {
  const count = Number(n) || 0;
  if (count <= 0) {
    return { n: 0, lastAt: null, fonte: "", texto: "Falha de login: nenhuma neste isolate (não grava e-mail)." };
  }
  const quando = lastAt ? String(lastAt) : "";
  return {
    n: count,
    lastAt: quando || null,
    fonte: "contador neste isolate, sem e-mail nem senha",
    texto: `Falha de login: ${count}${quando ? ` (última ${quando})` : ""}. Fonte: isolate, sem e-mail.`,
  };
}

export function parseJobMessage(message) {
  const m = String(message || "").match(/scanned=(\d+)\s+sent=(\d+)/i);
  if (!m) return null;
  return { scanned: Number(m[1]), sent: Number(m[2]) };
}

export function resumoJob(row) {
  if (!row) {
    return { texto: "Job de lembrete: não informado neste recorte.", fonte: "" };
  }
  const parsed = parseJobMessage(row.message);
  const when = row.created_at ? String(row.created_at) : "";
  const extra = parsed ? ` varridos ${parsed.scanned}, enviados ${parsed.sent}` : "";
  return {
    texto: `Último job de lembrete${when ? ` em ${when}` : ""}${extra}.`,
    fonte: "api_error_events kind job_run",
    scanned: parsed?.scanned ?? null,
    sent: parsed?.sent ?? null,
  };
}

export function escolherUltimoJob(errors) {
  const list = (errors || []).filter((e) => String(e.kind || "") === "job_run");
  if (!list.length) return null;
  return list[0];
}
