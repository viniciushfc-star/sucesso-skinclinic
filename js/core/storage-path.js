export function storageObjectPath(bucket, stored) {
  if (stored == null) return "";
  let raw = String(stored).trim();
  if (!raw) return "";
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      raw = u.pathname + (u.search || "");
    }
  } catch {
    /* não é URL */
  }
  const q = raw.indexOf("?");
  if (q >= 0) raw = raw.slice(0, q);
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/object/public/${bucket}/`,
    `/object/sign/${bucket}/`,
  ];
  for (const marker of markers) {
    const i = raw.indexOf(marker);
    if (i >= 0) return decodeURIComponent(raw.slice(i + marker.length));
  }
  if (/^https?:\/\//i.test(String(stored).trim())) return "";
  return raw.replace(/^\/+/, "");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function storagePathOrgPrefix(path) {
  return String(path || "")
    .replace(/^\/+/, "")
    .split("/")[0] || "";
}

/** Path canônico: primeiro segmento = org. Path legado sem UUID não é tratado como IDOR aqui. */
export function rejectsForeignOrgStoragePath(path, orgId) {
  if (!path || !orgId) return false;
  const first = storagePathOrgPrefix(path);
  if (!UUID_RE.test(first)) return false;
  return first !== String(orgId);
}

export function isOrgOwnedStoragePath(path, orgId) {
  if (!path || !orgId) return false;
  return storagePathOrgPrefix(path) === String(orgId);
}
