/**
 * PostgREST/Postgres recusam colunas que o app já envia, mas o banco live ainda não tem.
 * Tira só a coluna citada no erro; não apaga o restante do payload.
 */

export function columnFromPostgrestError(message) {
  const msg = String(message || "");
  const m =
    msg.match(/Could not find the ['"]([^'"]+)['"] column/i) ||
    msg.match(/column ["']([^"']+)["'] of relation/i) ||
    msg.match(/column ["']([^"']+)["'] does not exist/i);
  return m ? m[1] : null;
}

export function isUnknownColumnError(error) {
  const msg = String(error?.message || error || "");
  const code = String(error?.code || "");
  return (
    code === "42703" ||
    /schema cache/i.test(msg) ||
    /column .+ does not exist/i.test(msg) ||
    /Could not find the '.+' column/i.test(msg)
  );
}

export function stripUnknownColumn(row, error, { immutable = [] } = {}) {
  const col = columnFromPostgrestError(error?.message || error);
  if (!col || immutable.includes(col) || !Object.prototype.hasOwnProperty.call(row, col)) {
    return null;
  }
  const next = { ...row };
  delete next[col];
  return next;
}

export async function retryUnknownColumns(payload, write, { immutable = [], max = 16 } = {}) {
  let attempt = { ...payload };
  let last = { data: null, error: new Error("gravação vazia") };
  for (let i = 0; i < max; i++) {
    last = await write(attempt);
    if (!last?.error) return last;
    const next = stripUnknownColumn(attempt, last.error, { immutable });
    if (!next) return last;
    attempt = next;
  }
  return last;
}
