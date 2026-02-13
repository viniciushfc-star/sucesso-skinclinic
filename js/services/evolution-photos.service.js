/**
 * Fotos de evolução (antes/depois) do cliente para prontuário.
 * Upload no bucket client-photos em org_id/client_id/evolution/{id}.ext
 */
import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";

const BUCKET = "client-photos";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

/**
 * Lista fotos de evolução do cliente (ordenadas por data decrescente).
 */
export async function listEvolutionPhotosByClient(clientId) {
  if (!clientId) return [];
  const orgId = getOrgOrThrow();
  const { data, error } = await supabase
    .from("client_evolution_photos")
    .select("id, taken_at, photo_url, type, procedure_id, notes, created_at")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .order("taken_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Upload de arquivo e criação do registro.
 * @param {string} clientId
 * @param {Date|string} takenAt - data da foto (YYYY-MM-DD)
 * @param {"antes"|"depois"} type
 * @param {File} file
 * @param {string} [procedureId]
 * @param {string} [notes]
 */
export async function addEvolutionPhoto(clientId, takenAt, type, file, procedureId = null, notes = null) {
  const orgId = getOrgOrThrow();
  if (!clientId || !takenAt || !type || !file) throw new Error("Dados obrigatórios: cliente, data, tipo e arquivo.");
  const dateStr = typeof takenAt === "string" ? takenAt.slice(0, 10) : new Date(takenAt).toISOString().slice(0, 10);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "jpg");
  const id = crypto.randomUUID();
  const path = `${orgId}/${clientId}/evolution/${id}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const photoUrl = urlData?.publicUrl || null;
  if (!photoUrl) throw new Error("Não foi possível obter a URL da foto.");

  const { data, error } = await supabase
    .from("client_evolution_photos")
    .insert({
      org_id: orgId,
      client_id: clientId,
      taken_at: dateStr,
      photo_url: photoUrl,
      type: type === "depois" ? "depois" : "antes",
      procedure_id: procedureId || null,
      notes: notes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Remove foto de evolução (não remove do Storage para não quebrar histórico; opcionalmente limpar Storage depois).
 */
export async function deleteEvolutionPhoto(id) {
  const orgId = getOrgOrThrow();
  const { error } = await supabase
    .from("client_evolution_photos")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) throw error;
}
