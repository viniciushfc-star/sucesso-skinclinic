import { supabase } from "./supabase.js";
import { storageObjectPath } from "./storage-path.js";

export { storageObjectPath };

export async function signedStorageUrl(bucket, stored, expiresIn = 3600) {
  const path = storageObjectPath(bucket, stored);
  if (!path || path.includes("..")) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
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
