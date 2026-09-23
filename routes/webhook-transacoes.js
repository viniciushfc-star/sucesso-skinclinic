/**
 * Webhook: transações em tempo real (cartão/conta vinculada)
 * Recebe POST do agregador (Belvo, Pluggy, etc.) ou de conector próprio.
 * Valida segredo, localiza conta por external_account_id, grava no financeiro.
 */

import { createClient } from "@supabase/supabase-js";
import { secretsEqual } from "../lib/http-security.js";
import { recordWebhookFailure } from "../lib/observability.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const SECRET = process.env.WEBHOOK_TRANSACTIONS_SECRET || "";
  const incomingSecret = req.headers["x-webhook-secret"] || req.headers["x-webhook-transactions-secret"] || "";
  if (!SECRET) {
    console.error("[webhook-transacoes] WEBHOOK_TRANSACTIONS_SECRET não configurado");
    recordWebhookFailure({ status: 401, message: "WEBHOOK_TRANSACTIONS_SECRET ausente" });
    return res.status(401).json({ error: "Não autenticado" });
  }
  if (!secretsEqual(SECRET, incomingSecret)) {
    return res.status(401).json({ error: "Não autenticado" });
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
    recordWebhookFailure({ status: 404, message: "conta vinculada nao encontrada" });
    return res.status(404).json({
      error: "Conta vinculada não encontrada ou inativa",
    });
  }

  const { data: members } = await supabase
    .from("organization_users")
    .select("user_id")
    .eq("org_id", conta.org_id)
    .limit(1);
  const userId = members?.[0]?.user_id ?? null;

  const rows = [];
  let semIdentidade = 0;
  for (const t of rawTransactions) {
      const date = normalizeDate(t.date);
      const amount = Number(t.amount);
      const description = (t.description || t.descricao || "").trim().slice(0, 500) || "Transação em tempo real";
      const type = (t.type || "").toLowerCase();
      const tipo = type === "credit" || type === "entrada" || type === "c" || amount > 0 ? "entrada" : "saida";
      const valor = Math.abs(amount);
      if (!date || !Number.isFinite(valor) || valor <= 0) continue;
      const eventId = String(t.id || t.transaction_id || t.external_id || "").trim().slice(0, 120);
      if (!eventId) {
        semIdentidade += 1;
        continue;
      }
      rows.push({
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
        webhook_event_id: eventId,
      });
  }

  if (rows.length === 0) {
    if (semIdentidade > 0) {
      recordWebhookFailure({ status: 400, message: "evento sem webhook_event_id", orgId: conta.org_id });
      return res.status(400).json({ error: "Evento sem identidade idempotente. Recusado." });
    }
    return res.status(400).json({ error: "Nenhuma transação válida (date, amount obrigatórios)" });
  }

  const { error: errInsert } = await supabase.from("financeiro").insert(rows);
  if (errInsert) {
    if (errInsert.code === "23505") {
      return res.status(200).json({
        ok: true,
        conta: conta.nome_exibicao,
        recebidas: rawTransactions.length,
        gravadas: 0,
        duplicado: true,
      });
    }
    console.error("[webhook-transacoes] insert error", errInsert);
    req.webhookOrgId = conta.org_id;
    res.locals = res.locals || {};
    res.locals.obsMessage = String(errInsert.message || "").slice(0, 180);
    return res.status(500).json({ error: "Erro ao gravar transações" });
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

