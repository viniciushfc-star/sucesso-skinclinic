/**
 * Avaliações de produtos pelos profissionais (nota 1-5 + comentário).
 * Usado no Estoque e no Índice de cuidado (Equipe).
 */

import { supabase } from "../core/supabase.js";
import { getActiveOrg, withOrg } from "../core/org.js";

function getOrgOrThrow() {
  const orgId = getActiveOrg();
  if (!orgId) throw new Error("Organização ativa não definida");
  return orgId;
}

export async function createAvaliacao({ produto_nome, nota, comentario }) {
  const orgId = getOrgOrThrow();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const n = Math.min(5, Math.max(1, Number(nota) || 3));
  const { data, error } = await supabase
    .from("produto_avaliacoes")
    .insert({
      org_id: orgId,
      produto_nome: (produto_nome || "").trim(),
      user_id: user.id,
      user_email: user.email || "",
      nota: n,
      comentario: (comentario || "").trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listAvaliacoesByProduto(produto_nome) {
  const orgId = getOrgOrThrow();
  const { data, error } = await withOrg(
    supabase
      .from("produto_avaliacoes")
      .select("id, user_email, nota, comentario, created_at")
      .eq("produto_nome", (produto_nome || "").trim())
      .order("created_at", { ascending: false })
  );
  if (error) throw error;
  return data ?? [];
}

export async function getIndiceCuidado() {
  const orgId = getOrgOrThrow();
  const { data, error } = await withOrg(
    supabase
      .from("produto_avaliacoes")
      .select("user_id, user_email, nota")
  );
  if (error) throw error;
  const rows = data ?? [];
  const byUser = {};
  rows.forEach((r) => {
    const id = r.user_id;
    if (!byUser[id]) byUser[id] = { user_email: r.user_email, total: 0, soma_nota: 0 };
    byUser[id].total += 1;
    byUser[id].soma_nota += Number(r.nota) || 0;
  });
  return Object.entries(byUser)
    .map(([userId, v]) => ({
      user_id: userId,
      user_email: v.user_email,
      total_avaliacoes: v.total,
      media_nota: v.total > 0 ? (v.soma_nota / v.total).toFixed(1) : "—",
    }))
    .sort((a, b) => b.total_avaliacoes - a.total_avaliacoes);
}
