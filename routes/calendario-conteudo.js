/**
 * API Calendário de conteúdo.
 * GET/POST /api/calendario-conteudo?action=processar-agendados
 * Processa posts agendados cujo horário já passou: marca como publicado e cria notificação.
 * Uso: cron externo ou front ao abrir a view (o front usa o service direto; esta API processa todas as orgs).
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const action = req.query?.action || req.body?.action;
  if (action !== "processar-agendados") {
    return res.status(400).json({ error: "Use ?action=processar-agendados" });
  }

  try {
    const now = new Date().toISOString();
    const { data: vencidos, error: errList } = await supabase
      .from("conteudo_calendario")
      .select("id, org_id, titulo, conteudo")
      .eq("status", "agendado")
      .lte("agendado_para", now);

    if (errList) throw errList;
    const items = vencidos || [];

    for (const item of items) {
      await supabase
        .from("conteudo_calendario")
        .update({
          status: "publicado",
          publicado_em: now
        })
        .eq("id", item.id);

      const preview = (item.conteudo || "").slice(0, 200) + ((item.conteudo || "").length > 200 ? "…" : "");
      await supabase.from("notificacoes").insert({
        org_id: item.org_id,
        user_id: null,
        titulo: "Post agendado para agora",
        mensagem: (item.titulo ? `"${item.titulo}" — ` : "") + "Conteúdo pronto para publicar manualmente:\n\n" + preview
      });
    }

    return res.status(200).json({ ok: true, processados: items.length });
  } catch (err) {
    console.error("[CALENDARIO-API]", err);
    return res.status(500).json({ error: err.message || "Erro ao processar agendados" });
  }
}

