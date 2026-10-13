/**
 * Cobrança pelo app. Sem parceria (flag + chave) recusa — não cobra.
 */
import { requireStaffAccess, sendAuthError, getAdminClient } from "../lib/api-auth.js";
import { PARCELAS_MAXIMAS } from "../js/core/pagamento-regras.js";
import { MSG_PARCERIA, montarCobranca, montarInteresse, recusarSemParceria } from "../js/utils/pagamento-app.js";

function recusa(res) {
  return res.status(403).json({ error: MSG_PARCERIA, ativa: false });
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  let auth;
  try {
    auth = await requireStaffAccess(req, { permission: "financeiro:manage" });
  } catch (e) {
    return sendAuthError(res, e);
  }

  const recusaEnv = recusarSemParceria(process.env);

  if (req.method === "GET") {
    return res.status(200).json({
      ativa: !recusaEnv,
      motivo: recusaEnv || "",
    });
  }

  const acao = String(req.body?.acao || "cobrar");

  if (acao === "interesse") {
    let interesse;
    try {
      interesse = montarInteresse(req.body || {});
    } catch (err) {
      return res.status(400).json({ error: err.message || "Dados inválidos." });
    }
    const admin = getAdminClient();
    const { error } = await admin.from("pagamento_adesao").upsert(
      {
        org_id: auth.orgId,
        user_id: auth.user.id,
        ...interesse,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" }
    );
    if (error && /pagamento_adesao|schema cache|does not exist/i.test(error.message || "")) {
      return res.status(200).json({
        ok: true,
        via: "pendente_sql",
        aviso: "Interesse anotado nesta sessão. Cole supabase-fase0-cobrancas-app-colar.sql para gravar no banco.",
      });
    }
    if (error) return res.status(400).json({ error: "Não foi possível anotar o interesse." });
    return res.status(200).json({ ok: true, via: "banco", aviso: "Anotamos. Quando a parceria fechar, ligamos a cobrança." });
  }

  if (recusaEnv) return recusa(res);

  if (acao !== "cobrar") {
    return res.status(400).json({ error: "Ação inválida." });
  }

  let payload;
  try {
    payload = montarCobranca(req.body || {}, PARCELAS_MAXIMAS);
  } catch (err) {
    return res.status(400).json({ error: err.message || "Dados inválidos." });
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("cobrancas_app")
    .insert({
      org_id: auth.orgId,
      client_id: payload.client_id,
      agenda_id: payload.agenda_id,
      valor: payload.valor,
      metodo: payload.metodo,
      parcelas: payload.parcelas,
      descricao: payload.descricao,
      status: payload.status,
      criado_por: auth.user.id,
    })
    .select("id, status, valor, metodo")
    .single();

  if (error) {
    if (/cobrancas_app|schema cache|does not exist/i.test(error.message || "")) {
      return res.status(400).json({
        error: "Falta a tabela de cobranças. Cole supabase-fase0-cobrancas-app-colar.sql no Supabase.",
      });
    }
    return res.status(400).json({ error: "Não foi possível abrir a cobrança." });
  }

  return res.status(200).json({
    ok: true,
    cobranca: data,
    aviso: "A maquininha recebe o pedido. O caixa só muda quando alguém da clínica confirmar o recebimento.",
  });
}
