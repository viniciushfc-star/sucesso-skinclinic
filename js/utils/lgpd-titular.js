const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLgpdClientId(id) {
  return UUID_RE.test(String(id || ""));
}

export function stripRestrictedExportFields(table, rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (table !== "analise_pele") return list;
  return list.map((row) => {
    const copy = { ...row };
    delete copy.ia_preliminar;
    return copy;
  });
}

export function buildErasedClientPatch(clientId) {
  const short = String(clientId).replace(/-/g, "").slice(0, 12);
  return {
    name: "Titular excluído",
    email: `erased.${short}@lgpd.invalid`,
    phone: null,
    cpf: null,
    notes: null,
    avatar_url: null,
    birth_date: null,
    sex: null,
    state: "arquivado",
    consent_signed_name: null,
  };
}
