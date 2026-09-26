import { supabase } from "./supabase.js";
import { getActiveOrg } from "./org.js";
import { rejectsForeignOrgStoragePath, storageObjectPath } from "./storage-path.js";
import { clampSignedTtl, SIGNED_TTL_MAX } from "../utils/rls-prova.js";

export { storageObjectPath, clampSignedTtl, SIGNED_TTL_MAX };

export async function signedStorageUrl(bucket, stored, expiresIn = SIGNED_TTL_MAX) {
  const path = storageObjectPath(bucket, stored);
  if (!path || path.includes("..")) return null;
  const orgId = getActiveOrg();
  if (rejectsForeignOrgStoragePath(path, orgId)) return null;
  const ttl = clampSignedTtl(expiresIn);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttl);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function withSignedField(item, field, bucket) {
  if (!item || !item[field]) return item;
  const signed = await signedStorageUrl(bucket, item[field]);
  return signed ? { ...item, [field]: signed } : item;
}

export async function withSignedFields(items, field, bucket) {
  const list = Array.isArray(items) ? items : [];
  return Promise.all(list.map((item) => withSignedField(item, field, bucket)));
}
