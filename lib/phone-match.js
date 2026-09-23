/**
 * Telefone da Cloud API: só dígitos, BR com 55.
 * wa.me no browser não usa esta regra — envio humano.
 */

export function canonicalPhoneDigits(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d;
}

export function phonesMatch(a, b) {
  const x = canonicalPhoneDigits(a);
  const y = canonicalPhoneDigits(b);
  if (x.length < 12 || y.length < 12) return false;
  return x === y;
}

export function rowsIncludePhone(rows, target) {
  const list = Array.isArray(rows) ? rows : [];
  return list.some(
    (row) => phonesMatch(row?.phone, target) || phonesMatch(row?.telefone, target)
  );
}

/**
 * Cliente da org ou lead da espera da mesma org.
 * Falha a espera (tabela ausente) não libera o telefone.
 */
export async function orgOwnsWhatsappDestination(admin, orgId, phone) {
  if (!orgId || canonicalPhoneDigits(phone).length < 12) return false;

  const { data: clients, error: errClients } = await admin
    .from("clients")
    .select("id, phone")
    .eq("org_id", orgId);
  if (errClients) {
    console.error("[PHONE] clients", errClients.message);
    return false;
  }
  if (rowsIncludePhone(clients, phone)) return true;

  const { data: wait, error: errWait } = await admin
    .from("agenda_waitlist")
    .select("id, phone")
    .eq("org_id", orgId);
  if (errWait) return false;
  return rowsIncludePhone(wait, phone);
}
