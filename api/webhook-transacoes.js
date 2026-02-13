/**
 * Webhook: transações em tempo real (cartão/conta vinculada)
 * Recebe POST do agregador (Belvo, Pluggy, etc.) ou de conector próprio.
 * Valida segredo, localiza conta por external_account_id, grava no financeiro.
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const SECRET = process.env.WEBHOOK_TRANSACTIONS_SECRET || "";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const incomingSecret = req.headers["x-webhook-secret"] || req.headers["x-webhook-transactions-secret"] || "";
  if (SECRET && SECRET !== incomingSecret) {
    return res.status(401).json({ error: "Webhook não autorizado" });
  }

  const { account_id: accountId, transactions: rawTransactions } = req.body || {};
  if (!accountId || !Array.isArray(rawTransactions) || rawTransactions.length === 0) {
    return res.status(400).json({
      error: "Envie account_id e transactions (array com date, amount, description, type)",
    });
  }

  const { data: conta, error: errConta } = await supabase
    .from("contas_vinculadas")
    .select("id, org_id, nome_exibicao")
    .eq("external_account_id", accountId)
    .eq("status", "active")
    .single();

  if (errConta || !conta) {
    return res.status(404).json({
      error: "Conta vinculada não encontrada ou inativa",
      hint: "Verifique o account_id (external_account_id da conta vinculada).",
    });
  }

  const { data: members } = await supabase
    .from("organization_users")
    .select("user_id")
    .eq("org_id", conta.org_id)
    .limit(1);
  const userId = members?.[0]?.user_id ?? null;

  const rows = rawTransactions
    .map((t) => {
      const date = normalizeDate(t.date);
      const amount = Number(t.amount);
      const description = (t.description || t.descricao || "").trim().slice(0, 500) || "Transação em tempo real";
      const type = (t.type || "").toLowerCase();
      const tipo = type === "credit" || type === "entrada" || type === "c" || amount > 0 ? "entrada" : "saida";
      const valor = Math.abs(amount);
      if (!date || !Number.isFinite(valor) || valor <= 0) return null;
      return {
        org_id: conta.org_id,
        user_id: userId,
        descricao: description,
        tipo,
        valor,
        data: date,
        importado: true,
        origem_importacao: "api",
        conta_origem: conta.nome_exibicao,
        categoria_saida: null,
        procedure_id: null,
      };
    })
    .filter(Boolean);

  if (rows.length === 0) {
    return res.status(400).json({ error: "Nenhuma transação válida (date, amount obrigatórios)" });
  }

  const { error: errInsert } = await supabase.from("financeiro").insert(rows);
  if (errInsert) {
    console.error("[webhook-transacoes] insert error", errInsert);
    return res.status(500).json({ error: "Erro ao gravar transações", details: errInsert.message });
  }

  await supabase
    .from("contas_vinculadas")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", conta.id);

  res.status(200).json({
    ok: true,
    conta: conta.nome_exibicao,
    recebidas: rawTransactions.length,
    gravadas: rows.length,
  });
}

function normalizeDate(str) {
  if (!str) return null;
  const s = String(str).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const ddmmyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}
