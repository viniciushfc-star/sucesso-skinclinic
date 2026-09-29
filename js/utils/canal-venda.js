/**
 * Canal de venda de produto: cliente final (PF) e/ou profissional (revenda).
 * Não toda clínica é revendedora — a opção fica na clínica, não no cadastro de cada item.
 */

export const CANAL_VENDA_DEFAULT = {
  vende_para_cliente: true,
  vende_para_profissional: false,
};

export function canalVendaKey(orgId) {
  return `sc_canal_venda:${orgId || ""}`;
}

export function normalizeCanalVenda(raw = {}) {
  const cli = raw.vende_para_cliente;
  const pro = raw.vende_para_profissional;
  return {
    vende_para_cliente: cli === false || cli === "false" ? false : true,
    vende_para_profissional: pro === true || pro === "true" || pro === "on",
  };
}

export function readCanalVendaLocal(orgId) {
  try {
    const raw = JSON.parse(localStorage.getItem(canalVendaKey(orgId)) || "null");
    if (!raw || typeof raw !== "object") return null;
    return normalizeCanalVenda(raw);
  } catch {
    return null;
  }
}

export function writeCanalVendaLocal(orgId, canal) {
  try {
    localStorage.setItem(canalVendaKey(orgId), JSON.stringify(normalizeCanalVenda(canal)));
  } catch {
    /* ignore */
  }
}

export function mergeCanalVenda(profile, orgId) {
  const fromDb = normalizeCanalVenda(profile || {});
  const local = orgId ? readCanalVendaLocal(orgId) : null;
  if (profile && ("vende_para_profissional" in (profile || {}) || "vende_para_cliente" in (profile || {}))) {
    if (profile.vende_para_profissional != null || profile.vende_para_cliente != null) {
      return fromDb;
    }
  }
  return local || fromDb;
}
