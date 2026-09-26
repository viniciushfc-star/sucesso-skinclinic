/**
 * Job de lembrete automático: busca agendamentos das próximas 24h sem reminder_sent_at
 * e envia e-mail (Resend) e/ou WhatsApp Cloud API.
 *
 * POST ou GET /api/lembretes-auto
 * Cron (Vercel): Authorization Bearer CRON_SECRET — todas as clínicas.
 * Clínica logada: Bearer JWT + ?org=uuid — só a organização da sessão.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { isCronAuthorized, requireStaffAccess, sendAuthError } from "../lib/api-auth.js";
import { canonicalPhoneDigits } from "../lib/phone-match.js";
import { persistApiEvent } from "../lib/observability.js";

function getAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios");
  return createClient(url, key, { auth: { persistSession: false } });
}


function formatDateBr(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = String(isoDate).split("-");
  if (!d) return isoDate;
  return `${d}/${m}/${y}`;
}

function buildTexto({ nome, data, hora, clinica, link }) {
  const base = `Olá, ${nome}! Lembrete: você tem agendamento dia ${data} às ${hora}.`;
  if (link) return `${base} Confirme sua presença: ${link} — ${clinica}`;
  return `${base} — ${clinica}`;
}

async function sendEmail(to, subject, body) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "sem_resend" };
  const from = process.env.INVITE_EMAIL_FROM || "SkinClinic <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to: [to], subject, text: body })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { sent: false, reason: "resend_erro", detail };
  }
  return { sent: true, channel: "email" };
}

async function sendWhatsapp(toDigits, text) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId || !toDigits) return { sent: false, reason: "sem_whatsapp" };
  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: toDigits,
    type: "text",
    text: { preview_url: true, body: text }
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { sent: false, reason: "whatsapp_erro", detail };
  }
  return { sent: true, channel: "whatsapp" };
}

async function logEnvio(admin, row) {
  try {
    await admin.from("whatsapp_logs").insert(row);
  } catch (_) {}
}

export default async function lembretesAuto(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  let orgFiltro = null;
  if (!isCronAuthorized(req)) {
    try {
      const auth = await requireStaffAccess(req, { permission: "dashboard:view" });
      orgFiltro = auth.orgId;
    } catch (e) {
      return sendAuthError(res, e);
    }
  }

  let admin;
  try {
    admin = getAdmin();
  } catch (e) {
    console.error("[lembretes-auto] admin", e?.message || e);
    return res.status(500).json({ error: "Erro interno" });
  }
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const baseUrl = (process.env.BASE_URL || "").replace(/\/$/, "") || "https://skinclinic-one.vercel.app";

  let query = admin
    .from("agenda")
    .select("id, org_id, data, hora, cliente_id, reminder_sent_at, cancelled_at")
    .gte("data", today)
    .lte("data", tomorrow)
    .is("reminder_sent_at", null);
  if (orgFiltro) query = query.eq("org_id", orgFiltro);

  let { data: itens, error } = await query;
  if (error && String(error.message || "").includes("cancelled_at")) {
    let q2 = admin
      .from("agenda")
      .select("id, org_id, data, hora, cliente_id, reminder_sent_at")
      .gte("data", today)
      .lte("data", tomorrow)
      .is("reminder_sent_at", null);
    if (orgFiltro) q2 = q2.eq("org_id", orgFiltro);
    const retry = await q2;
    itens = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("[lembretes-auto]", error);
    return res.status(500).json({ error: "Erro interno" });
  }

  const pendentes = (itens || []).filter((a) => a.cliente_id && !a.cancelled_at);
  const resultados = [];

  for (const ag of pendentes) {
    if (orgFiltro && String(ag.org_id) !== String(orgFiltro)) {
      resultados.push({ id: ag.id, org_id: ag.org_id, ok: false, envios: [{ sent: false, reason: "cliente_outra_org" }] });
      continue;
    }
    const orgDoCliente = orgFiltro || ag.org_id;
    const { data: cli } = await admin
      .from("clients")
      .select("id, name, email, phone")
      .eq("id", ag.cliente_id)
      .eq("org_id", orgDoCliente)
      .maybeSingle();

    if (!cli) {
      resultados.push({ id: ag.id, org_id: ag.org_id, ok: false, envios: [{ sent: false, reason: "cliente_outra_org" }] });
      continue;
    }

    const nome = cli?.name || "Cliente";
    const email = (cli?.email || "").trim();
    const tel = canonicalPhoneDigits(cli?.phone);
    const dataFmt = formatDateBr(ag.data);
    const hora = ag.hora ? String(ag.hora).slice(0, 5) : "";

    let { data: org } = await admin.from("organizations").select("id, name").eq("id", ag.org_id).maybeSingle();
    const clinica = org?.name || "Clínica";

    let link = "";
    try {
      const token = randomUUID();
      await admin.from("appointment_confirmations").insert({
        appointment_id: ag.id,
        org_id: ag.org_id,
        token
      });
      link = `${baseUrl}/portal.html?confirmToken=${encodeURIComponent(token)}`;
    } catch (_) {}

    const texto = buildTexto({ nome, data: dataFmt, hora, clinica, link });
    const assunto = `Lembrete: agendamento ${dataFmt} às ${hora} — ${clinica}`;

    const envios = [];
    if (email) envios.push(await sendEmail(email, assunto, texto));
    if (tel.length >= 12) {
      const { data: evs } = await admin
        .from("client_events")
        .select("client_id, event_type, description, created_at")
        .eq("org_id", ag.org_id)
        .eq("client_id", cli.id)
        .eq("event_type", SILENCIO_EVENT_TYPE)
        .order("created_at", { ascending: true })
        .limit(50);
      const hoje = now.toISOString().slice(0, 10);
      if (estaEmSilencio(mapaSilencioPorCliente(evs || [], hoje), cli.id)) {
        envios.push({ sent: false, reason: "silencio_humano" });
      } else {
        envios.push(await sendWhatsapp(tel, texto));
      }
    }

    const ok = envios.some((e) => e.sent);
    if (ok) {
      await admin.from("agenda").update({ reminder_sent_at: new Date().toISOString() }).eq("id", ag.id);
    }
    await logEnvio(admin, {
      org_id: ag.org_id,
      agenda_id: ag.id,
      channel: envios.map((e) => e.channel).filter(Boolean).join(",") || "nenhum",
      destino: email || tel || "",
      status: ok ? "enviado" : "falhou",
      detalhe: JSON.stringify(envios)
    });
    resultados.push({ id: ag.id, org_id: ag.org_id, ok, envios });
  }

  const sent = resultados.filter((r) => r.ok).length;
  const porOrg = new Map();
  for (const r of resultados) {
    const oid = r.org_id;
    if (!oid) continue;
    const cur = porOrg.get(oid) || { scanned: 0, sent: 0 };
    cur.scanned += 1;
    if (r.ok) cur.sent += 1;
    porOrg.set(oid, cur);
  }
  if (porOrg.size) {
    for (const [oid, st] of porOrg) {
      persistApiEvent({
        kind: "job_run",
        status: 200,
        method: req.method,
        route: "/api/lembretes-auto",
        orgId: oid,
        message: `scanned=${st.scanned} sent=${st.sent}`,
      });
    }
  } else {
    persistApiEvent({
      kind: "job_run",
      status: 200,
      method: req.method,
      route: "/api/lembretes-auto",
      orgId: orgFiltro,
      message: `scanned=${pendentes.length} sent=${sent}`,
    });
  }

  return res.status(200).json({
    ok: true,
    scanned: pendentes.length,
    sent,
    resultados
  });
}
