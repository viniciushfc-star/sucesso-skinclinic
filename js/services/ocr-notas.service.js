import { supabase } from "../core/supabase.js";
import { getActiveOrg } from "../core/org.js";

/**
 * Histórico da nota lida. Falha da tabela não impede a entrada no estoque.
 */
export async function saveOcrNota({ rawText, parsed }) {
  const orgId = getActiveOrg();
  if (!orgId) return null;
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("ocr_notas")
    .insert({
      org_id: orgId,
      raw_text: rawText ? String(rawText).slice(0, 20000) : null,
      parsed: parsed || null,
      created_by: auth?.user?.id || null,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    console.warn("[OCR] ocr_notas", error.message);
    return null;
  }
  return data?.id || null;
}
